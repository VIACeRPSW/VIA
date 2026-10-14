import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialCreateProfileState,
  initialUpdateProfileState,
} from "@/lib/profiles/profile-action-state";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createProfileAction, updateProfileAction } from "@/actions/profiles";

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

    describe("update profile action", () => {
      const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";

      function createUpdateClient({
        current = { id, username: "old_username" },
        written = { id },
        error = null,
        status = 200,
      }: {
        current?: { id: string; username: string } | null;
        written?: { id: string } | null;
        error?: { code: string } | null;
        status?: number;
      } = {}) {
        const eq = vi.fn<(column: string, value: string) => unknown>();
        const query = {
          select: vi.fn(() => query),
          eq,
          update: vi.fn(() => query),
          maybeSingle: vi.fn()
            .mockResolvedValueOnce({ data: current, error: null, status: 200 })
            .mockResolvedValueOnce({ data: written, error, status }),
        };
        eq.mockImplementation(() => query);
        mocks.createServerSupabaseClient.mockResolvedValue({ from: vi.fn(() => query) });
        return query;
      }

      beforeEach(() => {
        vi.clearAllMocks();
        mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "clerk-user-id" });
      });

      it("checks authentication before constructing a client", async () => {
        mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({ status: "unauthorized" });
        expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      });

      it("updates only the authenticated row and excludes forged privileged input and state", async () => {
        const query = createUpdateClient();
        const form = createFormData();
        form.set("id", "foreign-profile");
        form.set("clerk_user_id", "foreign-clerk-user");
        form.set("role", "admin");
        form.set("avatar_url", "https://foreign.example/avatar.png");
        form.set("updated_at", "2000-01-01");

        expect(await updateProfileAction({
          status: "success",
          values: { username: "forged_previous", displayName: "Forged", bio: "" },
        }, form)).toMatchObject({ status: "success", values: { username: "ada_42" } });
        expect(query.update).toHaveBeenCalledWith({
          username: "ada_42", display_name: "Ada Lovelace", bio: "Matemáticas e imaginación.",
        });
        expect(query.eq).toHaveBeenCalledWith("id", id);
        expect(query.eq.mock.calls.filter(([column]) => column === "clerk_user_id"))
          .toEqual([["clerk_user_id", "clerk-user-id"], ["clerk_user_id", "clerk-user-id"]]);
        expect(mocks.revalidatePath.mock.calls).toEqual([
          ["/perfil"], ["/perfil/editar"], ["/usuario/old_username"], ["/usuario/ada_42"],
        ]);
      });

      it("revalidates a retained public username only once", async () => {
        createUpdateClient({ current: { id, username: "ada_42" } });
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({ status: "success" });
        expect(mocks.revalidatePath.mock.calls).toEqual([
          ["/perfil"], ["/perfil/editar"], ["/usuario/ada_42"],
        ]);
      });

      it("preserves invalid values and does not write or revalidate", async () => {
        const query = createUpdateClient();
        expect(await updateProfileAction(initialUpdateProfileState, createFormData("invalid-name")))
          .toMatchObject({ status: "invalid", values: { username: "invalid-name" } });
        expect(query.maybeSingle).not.toHaveBeenCalled();
        expect(query.update).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      });

      it("associates a username conflict with the username field", async () => {
        createUpdateClient({ written: null, error: { code: "23505" }, status: 409 });
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({
            status: "conflict",
            fieldErrors: { username: ["Ese nombre de usuario ya está ocupado."] },
            values: { username: "Ada_42" },
          });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
      });

      it("does not report success when the profile disappeared before writing", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        createUpdateClient({ written: null });
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({ status: "error" });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        log.mockRestore();
      });

      it("handles a fetch failure with an empty database code without reporting success", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        createUpdateClient({ written: null, error: { code: "" }, status: 0 });
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({ status: "error" });
        expect(log).toHaveBeenCalledWith("Profile update failed", {
          code: "SUPABASE_QUERY_ERROR", status: 0,
        });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        log.mockRestore();
      });

      it("presents a redacted configuration failure and preserves editable values", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.createServerSupabaseClient.mockRejectedValueOnce(new Error("private-secret"));
        expect(await updateProfileAction(initialUpdateProfileState, createFormData()))
          .toMatchObject({ status: "error", values: { username: "Ada_42" } });
        expect(log).toHaveBeenCalledWith("Profile update client could not start", { errorType: "Error" });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        log.mockRestore();
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