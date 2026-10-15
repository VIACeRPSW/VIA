import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  createPublicSupabaseClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
  createPublicSupabaseClient: mocks.createPublicSupabaseClient,
}));

import { getOwnProfile, getPublicProfile } from "@/lib/profiles/read-profile.server";

const row = {
  id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a",
  clerk_user_id: "owner-clerk-id",
  username: "ada_42",
  display_name: "Ada",
  bio: "",
  avatar_url: null,
  role: "user",
};

function mockClient(data: unknown = row) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null, status: 200 })),
  };
  const client = {
    from: vi.fn(() => query),
    rpc: vi.fn(() => query),
  };
  mocks.createServerSupabaseClient.mockResolvedValue(client);
  mocks.createPublicSupabaseClient.mockReturnValue(client);
  return { client, query };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "owner-clerk-id" });
});
afterEach(() => vi.restoreAllMocks());

describe("server profile queries", () => {
  it("rejects an absent session before creating a database client", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await getOwnProfile()).toEqual({ status: "unauthorized" });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("always restricts the own query to the authenticated Clerk identity", async () => {
    const { client, query } = mockClient();
    expect(await getOwnProfile()).toMatchObject({
      status: "found", profile: { clerkUserId: "owner-clerk-id" },
    });

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(query.eq).toHaveBeenCalledWith("clerk_user_id", "owner-clerk-id");
    expect(query.select).toHaveBeenCalledWith(
      "id, clerk_user_id, username, display_name, bio, avatar_url, role",
    );
  });

  it("reads a public profile without Clerk, table access or internal fields", async () => {
    const { client } = mockClient();
    const result = await getPublicProfile("ada_42");
    expect(result).toMatchObject({ status: "found" });
    expect(JSON.stringify(result)).not.toMatch(/owner-clerk-id|clerkUserId|"id"/);
    expect(client.rpc).toHaveBeenCalledWith("get_public_profile", { p_username: "ada_42" });
    expect(client.from).not.toHaveBeenCalled();
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it.each(["user", "moderator", "admin"])("accepts the stored role %s", async (role) => {
    mockClient({ ...row, role });
    expect(await getOwnProfile()).toMatchObject({ status: "found", profile: { role } });
  });

  it.each([undefined, null, "", "owner", "ADMIN"])("fails closed for an invalid stored role %s", async (role) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockClient({ ...row, role });
    expect(await getOwnProfile()).toEqual({ status: "unavailable" });
    expect(log).toHaveBeenCalledWith("Supabase profile response violated the contract", {
      code: "INVALID_PROFILE_RESPONSE",
    });
  });

  it("does not normalize non-canonical public usernames or query the database", async () => {
    expect(await getPublicProfile("Ada_42")).toEqual({ status: "missing" });
    expect(mocks.createPublicSupabaseClient).not.toHaveBeenCalled();
  });

  it("distinguishes a missing profile from a configuration failure", async () => {
    mockClient(null);
    expect(await getPublicProfile("ada_42")).toEqual({ status: "missing" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createPublicSupabaseClient.mockImplementation(() => {
      throw new Error("private configuration");
    });
    expect(await getPublicProfile("ada_42")).toEqual({ status: "unavailable" });
  });
});
