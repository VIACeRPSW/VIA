import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupPostUploadsAction, createPostAction } from "./posts";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), client: vi.fn(), repository: vi.fn(),
  prepare: vi.fn(), publish: vi.fn(), revalidate: vi.fn(), cleanup: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/lib/posts/post-image.server", () => ({ preparePostImage: mocks.prepare }));
vi.mock("@/lib/posts/post-repository.server", () => ({ postRepository: mocks.repository }));
vi.mock("@/lib/posts/publish-post", () => ({ publishPost: mocks.publish }));
const operation = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const category = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    operationId: operation, title: " Title ", description: "", categoryId: category, hashtags: "#CIENCIA",
  })) data.set(key, value);
  data.set("image", new File(["image"], "image.png", { type: "image/png" }));
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "own-user" });
  mocks.profile.mockResolvedValue({ status: "found", profile: { clerkUserId: "own-user", username: "own_user" } });
  mocks.client.mockResolvedValue({});
  mocks.repository.mockReturnValue({ cleanup: mocks.cleanup });
  mocks.cleanup.mockResolvedValue(true);
  mocks.prepare.mockResolvedValue({ success: true, buffer: Buffer.from("normalized") });
  mocks.publish.mockResolvedValue({ status: "success", postId: operation });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("post actions", () => {
  it("requires authentication before data access", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await createPostAction({ status: "idle" }, form())).toMatchObject({ status: "unauthorized" });
    expect(await cleanupPostUploadsAction()).toMatchObject({ status: "unauthorized" });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(["missing", "unavailable", "unauthorized"])("fails closed for profile %s", async (status) => {
    mocks.profile.mockResolvedValue({ status });
    expect(await createPostAction({ status: "idle" }, form())).toMatchObject({
      status: status === "unauthorized" ? "unauthorized" : "error",
    });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it("rejects a profile from another session", async () => {
    mocks.profile.mockResolvedValue({ status: "found", profile: { clerkUserId: "foreign" } });
    expect(await createPostAction({ status: "idle" }, form())).toMatchObject({ status: "error" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("normalizes an allowlist and ignores forged identity and previous state", async () => {
    const data = form();
    for (const key of ["user_id", "clerk_user_id", "image_path", "status", "role"]) data.set(key, "foreign");
    expect(await createPostAction({ status: "success", postId: "foreign" }, data))
      .toMatchObject({ status: "success", postId: operation });
    expect(mocks.repository).toHaveBeenCalledWith({}, "own-user");
    expect(mocks.publish).toHaveBeenCalledWith({
      operationId: operation, title: "Title", description: "", categoryId: category, hashtags: ["ciencia"],
    }, Buffer.from("normalized"), expect.stringMatching(/^[a-f0-9]{64}$/),
    expect.stringMatching(/^[a-f0-9-]{36}$/), expect.anything());
    expect(mocks.revalidate.mock.calls).toEqual([
      [`/post/${operation}`], [`/post/${operation}/editar`], ["/perfil"], ["/inicio"], ["/imagenes"], ["/usuario/own_user"],
    ]);
  });
  it("never touches Storage for invalid metadata or image", async () => {
    const invalid = form(); invalid.set("hashtags", "");
    expect(await createPostAction({ status: "idle" }, invalid)).toMatchObject({ status: "invalid" });
    const absent = form(); absent.delete("image");
    expect(await createPostAction({ status: "idle" }, absent)).toMatchObject({ status: "invalid" });
    mocks.prepare.mockResolvedValue({ success: false, message: "Bad image" });
    expect(await createPostAction({ status: "idle" }, form()))
      .toMatchObject({ status: "invalid", fieldErrors: { image: "Bad image" } });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([true, false])("reports cleanup completion %s", async (clean) => {
    mocks.cleanup.mockResolvedValue(clean);
    expect(await cleanupPostUploadsAction()).toMatchObject({
      status: clean ? "idle" : "busy", cleanupPending: !clean,
    });
  });
  it("surfaces connection errors without exposing their messages", async () => {
    mocks.client.mockRejectedValue(new Error("private-token"));
    expect(await createPostAction({ status: "idle" }, form())).toMatchObject({ status: "error", cleanupPending: true });
    expect(await cleanupPostUploadsAction()).toMatchObject({ status: "error", cleanupPending: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
