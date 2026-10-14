import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarAction } from "@/actions/avatars";
import { initialAvatarState } from "@/lib/profiles/avatar-operation";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getOwnProfile: vi.fn(), createClient: vi.fn(), repository: vi.fn(),
  prepare: vi.fn(), change: vi.fn(), revalidate: vi.fn(), ownedPath: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.getOwnProfile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));
vi.mock("@/lib/profiles/avatar-image.server", () => ({ prepareAvatar: mocks.prepare }));
vi.mock("@/lib/profiles/avatar-path", () => ({ ownedAvatarPath: mocks.ownedPath }));
vi.mock("@/lib/profiles/avatar-repository.server", () => ({
  avatarFolder: () => "opaque-owner", avatarRepository: mocks.repository,
}));
vi.mock("@/lib/profiles/avatar-operation", async (original) => ({
  ...await original<typeof import("@/lib/profiles/avatar-operation")>(), changeAvatar: mocks.change,
}));

const cleanup = vi.fn();
function form(operation: string = "upload") {
  const data = new FormData();
  data.set("operation", operation);
  data.set("avatar", new File(["image"], "avatar.png", { type: "image/png" }));
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "own-user" });
  mocks.getOwnProfile.mockResolvedValue({
    status: "found", profile: { username: "own_username", avatarUrl: null },
  });
  mocks.createClient.mockResolvedValue({
    storage: { from: () => ({ getPublicUrl: (path: string) => ({ data: { publicUrl: `https://example.supabase.co/${path}` } }) }) },
  });
  mocks.repository.mockReturnValue({ cleanup });
  cleanup.mockResolvedValue(true);
  mocks.prepare.mockResolvedValue({ success: true, buffer: Buffer.from("normalized") });
  mocks.change.mockResolvedValue({ status: "success", avatarChanged: true });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("avatar server action", () => {
  it("requires authentication before querying data", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await avatarAction(initialAvatarState, form())).toMatchObject({ status: "unauthorized" });
    expect(mocks.getOwnProfile).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it.each(["unauthorized", "not-found", "unavailable"])("stops on profile status %s", async (status) => {
    mocks.getOwnProfile.mockResolvedValue({ status });
    expect(await avatarAction(initialAvatarState, form())).toMatchObject({
      status: status === "unauthorized" ? "unauthorized" : "error",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects unknown operations without creating a client", async () => {
    expect(await avatarAction(initialAvatarState, form("overwrite"))).toMatchObject({ status: "error" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("ignores forged identity, reference, path and previous state", async () => {
    const data = form();
    for (const name of ["clerk_user_id", "owner", "path", "avatar_url"]) data.set(name, "foreign");
    await avatarAction({ status: "success", message: "foreign" }, data);
    expect(mocks.repository).toHaveBeenCalledWith(expect.anything(), "own-user");
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), null, {
      path: expect.stringMatching(/^opaque-owner\/[a-f0-9-]{36}\.webp$/),
      url: expect.stringContaining("https://example.supabase.co/opaque-owner/"),
      buffer: Buffer.from("normalized"),
    });
    expect(mocks.revalidate.mock.calls).toEqual([["/perfil"], ["/perfil/editar"], ["/usuario/own_username"]]);
  });
  it("does not mutate storage for an invalid image or absent file", async () => {
    mocks.prepare.mockResolvedValue({ success: false, message: "Invalid image" });
    expect(await avatarAction(initialAvatarState, form())).toMatchObject({ status: "error", message: "Invalid image" });
    const data = form(); data.delete("avatar");
    expect(await avatarAction(initialAvatarState, data)).toMatchObject({ status: "error" });
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("removes only the persisted own reference", async () => {
    mocks.getOwnProfile.mockResolvedValue({ status: "found", profile: { username: "own", avatarUrl: "persisted" } });
    await avatarAction(initialAvatarState, form("remove"));
    expect(mocks.change).toHaveBeenCalledWith(expect.anything(), "persisted", null);
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it.each([true, false])("revalidates cleanup and reports its outcome %s", async (clean) => {
    cleanup.mockResolvedValue(clean);
    expect(await avatarAction(initialAvatarState, form("cleanup"))).toMatchObject({
      status: clean ? "success" : "warning", cleanupPending: !clean,
    });
    expect(mocks.revalidate).toHaveBeenCalledWith("/perfil/editar");
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("surfaces network failures without logging secrets", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createClient.mockRejectedValue(new Error("secret-token"));
    expect(await avatarAction(initialAvatarState, form())).toMatchObject({ status: "error", cleanupPending: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret-token");
  });
});
