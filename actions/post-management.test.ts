import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deletePostAction, deletePostAndRedirectAction, updatePostAction } from "./posts";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), client: vi.fn(), repository: vi.fn(),
  cleanup: vi.fn(), prepare: vi.fn(), publish: vi.fn(), revalidate: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/lib/posts/post-image.server", () => ({ preparePostImage: mocks.prepare }));
vi.mock("@/lib/posts/post-repository.server", () => ({ postRepository: mocks.repository }));
vi.mock("@/lib/posts/publish-post", () => ({ publishPost: mocks.publish }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    postId: id, version: "1", operationId: id, title: " Updated ", description: "",
    categoryId: id, hashtags: "#ARTE", confirmed: "yes",
  })) data.set(key, value);
  return data;
}
function store({ version = 1, missing = false, stale = false, deletion = true, fail = false } = {}) {
  const requests: { method: string; url: string; body: string }[] = [];
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push({ method: request.method, url: request.url, body: await request.text() });
      if (fail) return Response.json({ code: "FAIL", message: "private-token" }, { status: 400 });
      if (request.method === "DELETE") return Response.json(deletion ? [{ id }] : []);
      if (request.method === "PATCH") return Response.json(stale ? [] : [{ id }]);
      if (request.method === "POST") return Response.json(id);
      return Response.json(missing ? [] : [{ id, version }]);
    } },
  });
  mocks.client.mockResolvedValue(client);
  return requests;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "own" });
  mocks.profile.mockResolvedValue({ status: "found", profile: { clerkUserId: "own", username: "own_user" } });
  mocks.cleanup.mockResolvedValue(true);
  mocks.repository.mockReturnValue({ cleanup: mocks.cleanup, begin: vi.fn().mockResolvedValue({ status: "published", post_id: "foreign" }) });
  mocks.prepare.mockResolvedValue({ success: true, buffer: Buffer.from("normalized") });
  mocks.publish.mockResolvedValue({ status: "success", postId: id });
  mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("post management actions", () => {
  it("requires a session before editing or deleting", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await updatePostAction({ status: "idle" }, form())).toMatchObject({ status: "unauthorized" });
    expect(await deletePostAction({ status: "idle" }, form())).toMatchObject({ status: "unauthorized" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation and validates the version", async () => {
    const data = form(); data.delete("confirmed");
    expect(await deletePostAction({ status: "idle" }, data)).toMatchObject({ status: "invalid" });
    data.set("version", "-1");
    expect(await updatePostAction({ status: "idle" }, data)).toMatchObject({ status: "invalid" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("never updates a row invisible under ownership RLS", async () => {
    const requests = store({ missing: true });
    expect(await updatePostAction({ status: "idle" }, form())).toMatchObject({ status: "error" });
    expect(requests.map((request) => request.method)).toEqual(["GET"]);
  });
  it("updates only allowlisted metadata with a version predicate and no image upload", async () => {
    const requests = store();
    const data = form(); data.set("user_id", "foreign"); data.set("image_path", "foreign");
    expect(await updatePostAction({ status: "idle" }, data)).toMatchObject({ status: "success", cleanupPending: false });
    const patch = requests.find((request) => request.method === "PATCH")!;
    expect(patch.url).toContain("version=eq.1");
    expect(JSON.parse(patch.body)).toEqual({ title: "Updated", description: "", category_id: id, hashtags: ["arte"] });
    expect(mocks.publish).not.toHaveBeenCalled();
  });
  it.each([{ version: 2 }, { stale: true }])("reports optimistic concurrency conflicts", async (options) => {
    store(options);
    expect(await updatePostAction({ status: "idle" }, form())).toMatchObject({ status: "conflict" });
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("replaces an image only through the verified replacement RPC", async () => {
    const requests = store();
    const data = form(); data.set("image", new File(["image"], "new.png", { type: "image/png" }));
    await updatePostAction({ status: "idle" }, data);
    const repository = mocks.publish.mock.calls[0][4];
    expect(await repository.begin({}, "digest", "lease")).toEqual({ status: "conflict" });
    expect(await repository.commit(id, id)).toBe(id);
    const rpc = requests.find((request) => request.method === "POST")!;
    expect(rpc.url).toContain("/rpc/commit_post_image_replacement");
    expect(JSON.parse(rpc.body)).toEqual({ p_post_id: id, p_version: 1, p_operation_id: id, p_lease_id: id });
  });
  it("reports a stale deletion without removing its image", async () => {
    store({ deletion: false });
    expect(await deletePostAction({ status: "idle" }, form())).toMatchObject({ status: "conflict" });
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it("allows an idempotent repeat after the row has already gone", async () => {
    store({ deletion: false, missing: true });
    expect(await deletePostAction({ status: "idle" }, form())).toMatchObject({ status: "deleted", cleanupPending: false });
    expect(mocks.cleanup).toHaveBeenCalledOnce();
  });
  it("distinguishes content retirement from failed object cleanup", async () => {
    store(); mocks.cleanup.mockRejectedValue(new Error("private-token"));
    expect(await deletePostAction({ status: "idle" }, form())).toMatchObject({ status: "deleted", cleanupPending: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("reports service failures instead of pretending deletion succeeded", async () => {
    store({ fail: true });
    expect(await deletePostAction({ status: "idle" }, form())).toMatchObject({ status: "error" });
    expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it.each([true, false])("redirects after retirement before rendering the missing detail, cleanup=%s", async (clean) => {
    store(); mocks.cleanup.mockResolvedValue(clean);
    await expect(deletePostAndRedirectAction({ status: "idle" }, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith(`/imagenes?retirado=1${clean ? "" : "&limpieza=pendiente"}`);
  });
});
