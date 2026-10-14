import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSafeAvatarUrl,
  isCanonicalUsername,
  ownProfileSchema,
  publicProfileSchema,
  resolveProfileRead,
} from "@/lib/profiles/read-profile";

const row = {
  id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a",
  clerk_user_id: "private-clerk-id",
  username: "ada_42",
  display_name: "Ada Lovelace",
  bio: "Matemáticas e imaginación.",
  avatar_url: null,
  role: "user",
  created_at: "2026-10-14",
};

afterEach(() => vi.restoreAllMocks());

describe("profile read contract", () => {
  it("maps only the five public fields even when the source contains private data", () => {
    const profile = publicProfileSchema.parse(row);
    expect(profile).toEqual({
      username: "ada_42",
      displayName: "Ada Lovelace",
      bio: "Matemáticas e imaginación.",
      avatarUrl: null,
      role: "user",
    });
    expect(JSON.stringify(profile)).not.toMatch(/private-clerk-id|created_at|clerkUserId/);
    expect(ownProfileSchema.parse(row)).toMatchObject({
      id: row.id,
      clerkUserId: row.clerk_user_id,
    });
  });

  it.each(["Ada_42", " ada_42", "ada_42 ", "ada_42\n", "ab", "a".repeat(31), "áda", "ada/42"])(
    "rejects a non-canonical public username: %s",
    (username) => expect(isCanonicalUsername(username)).toBe(false),
  );

  it("accepts the exact canonical username boundaries", () => {
    expect(isCanonicalUsername("a_1")).toBe(true);
    expect(isCanonicalUsername("a".repeat(30))).toBe(true);
  });

  it("distinguishes found and missing profiles", async () => {
    await expect(resolveProfileRead(async () => ({
      data: row, error: null, status: 200,
    }), publicProfileSchema)).resolves.toMatchObject({
      status: "found", profile: { username: "ada_42" },
    });
    await expect(resolveProfileRead(async () => ({
      data: null, error: null, status: 200,
    }), publicProfileSchema)).resolves.toEqual({ status: "missing" });
  });

  it.each([401, 403, 503])("handles a query failure with redacted logs: %s", async (status) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveProfileRead(async () => ({
      data: null,
      error: { code: "PGRST000", message: "secret user@example.com" },
      status,
    }), publicProfileSchema)).resolves.toEqual({
      status: status === 503 ? "unavailable" : "unauthorized",
    });
    expect(log).toHaveBeenCalledWith("Supabase profile read failed", {
      code: "PGRST000", status,
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
  });

  it("reports a thrown network error without exposing its message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveProfileRead(async () => {
      throw new Error("private-clerk-id secret");
    }, publicProfileSchema)).resolves.toEqual({ status: "unavailable" });
    expect(log).toHaveBeenCalledWith("Supabase profile read could not start", {
      errorType: "Error",
    });
  });

  it.each([
    { ...row, role: "owner" },
    { ...row, username: "Ada" },
    { ...row, display_name: null },
    { ...row, bio: "a".repeat(301) },
    undefined,
  ])("fails closed for an invalid response", async (data) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(resolveProfileRead(async () => ({
      data, error: null, status: 200,
    }), publicProfileSchema)).resolves.toEqual({ status: "unavailable" });
  });
});

describe("avatar references", () => {
  const origin = "https://example.supabase.co";
  const avatar = `${origin}/storage/v1/object/public/avatars/owner/image.png`;

  it("allows only public avatar objects from the configured Supabase origin", () => {
    expect(getSafeAvatarUrl(null, origin)).toBeNull();
    expect(getSafeAvatarUrl(avatar, origin)).toBe(avatar);
  });

  it.each([
    "https://other.example/avatar.png",
    "javascript:alert(1)",
    `${avatar}?token=private`,
    `${origin}/storage/v1/object/public/posts/image.png`,
    `${origin}/storage/v1/object/public/avatars/../posts/image.png`,
    "not-a-url",
  ])("rejects unsafe avatar references without logging the URL", (url) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(getSafeAvatarUrl(url, origin)).toBeNull();
    expect(log).toHaveBeenCalledWith("Profile avatar reference is not allowed", {
      code: "INVALID_AVATAR_REFERENCE",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(url);
  });
});
