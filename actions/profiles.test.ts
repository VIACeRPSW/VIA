import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialCreateProfileState } from "@/lib/profiles/profile-action-state";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { createProfileAction } from "@/actions/profiles";

function createFormData(username = "Ada_42") {
  const formData = new FormData();
  formData.set("username", username);
  formData.set("displayName", "Ada Lovelace");
  formData.set("bio", "Matemáticas e imaginación.");
  return formData;
}

function createSupabaseMock({
  currentProfile = null,
  insertError,
}: {
  currentProfile?: { id: string } | null;
  insertError?: { code: string };
} = {}) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: currentProfile, error: null })),
    insert: vi.fn(async () => ({
      error: insertError ?? null,
      status: insertError ? 409 : 201,
    })),
  };
  const client = { from: vi.fn(() => query) };
  mocks.createServerSupabaseClient.mockResolvedValue(client);
  return { client, query };
}

describe("create profile action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      isAuthenticated: true,
      userId: "clerk-user-id",
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("rejects an absent session before accessing Supabase", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });

    await expect(
      createProfileAction(initialCreateProfileState, createFormData()),
    ).resolves.toMatchObject({ status: "unauthorized" });
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("inserts only the authenticated identity and redirects", async () => {
    const { query } = createSupabaseMock();

    await expect(
      createProfileAction(initialCreateProfileState, createFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(query.insert).toHaveBeenCalledWith({
      clerk_user_id: "clerk-user-id",
      username: "ada_42",
      display_name: "Ada Lovelace",
      bio: "Matemáticas e imaginación.",
    });
    expect(mocks.redirect).toHaveBeenCalledWith("/perfil");
  });

  it("does not insert again when the profile already exists", async () => {
    const { query } = createSupabaseMock({
      currentProfile: { id: "profile-id" },
    });

    await expect(
      createProfileAction(initialCreateProfileState, createFormData()),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(query.insert).not.toHaveBeenCalled();
  });

  it("returns a controlled username conflict", async () => {
    createSupabaseMock({ insertError: { code: "23505" } });

    await expect(
      createProfileAction(initialCreateProfileState, createFormData()),
    ).resolves.toMatchObject({
      status: "conflict",
      message: "Ese nombre de usuario ya está ocupado.",
    });
  });
});