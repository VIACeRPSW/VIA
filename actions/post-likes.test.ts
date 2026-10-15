import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPostLikes, setPostLike } from "./post-likes";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), client: vi.fn(), publicClient: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.client, createPublicSupabaseClient: mocks.publicClient,
}));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const row = { post_id: id, like_count: 1, liked: true, can_like: true };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "own" });
  mocks.profile.mockResolvedValue({ status: "found", profile: { clerkUserId: "own" } });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.publicClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: [row], error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("post likes actions", () => {
  it("confirms desired state without accepting an actor or toggling", async () => {
    for (let index = 0; index < 2; index++) {
      expect(await setPostLike({ postId: id, liked: true })).toEqual({ status: "success", like: row });
    }
    expect(mocks.rpc.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      "set_post_like", { p_post_id: id, p_liked: true },
    ]));
    expect(mocks.revalidate).toHaveBeenCalledWith("/inicio");
    expect(mocks.revalidate).toHaveBeenCalledWith(`/post/${id}`);
    mocks.rpc.mockResolvedValue({ data: [{ ...row, liked: false, like_count: 0 }], error: null });
    expect(await setPostLike({ postId: id, liked: false })).toMatchObject({ status: "success", like: { liked: false, like_count: 0 } });
  });
  it("requires a live session and matching persisted profile", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({ status: "unauthorized" });
    expect(mocks.profile).not.toHaveBeenCalled();
    mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "other" });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({ status: "error" });
    mocks.profile.mockResolvedValue({ status: "missing" });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({ status: "error" });
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each([
    { postId: "invalid", liked: true },
    { postId: id, liked: "true" },
    { postId: id, liked: true, user_id: "other" },
  ])("rejects malformed or identity-bearing payloads", async (input) => {
    expect(await setPostLike(input)).toMatchObject({ status: "error" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["42501", "P0002", "SERVICE_ERROR"])("reports database failure %s without claiming success", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private-token" } });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({
      status: code === "42501" ? "unauthorized" : "error",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it.each([
    [], [row, row], [{ ...row, liked: false }], [{ ...row, can_like: false }],
    [{ ...row, like_count: -1 }], [{ ...row, post_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" }],
  ].map((data) => ({ data })))("rejects an unconfirmed or malformed mutation result", async ({ data }) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({ status: "error" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("uses the public client for anonymous batched counts", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false });
    mocks.rpc.mockResolvedValue({ data: [{ ...row, liked: null, can_like: false }], error: null });
    expect(await loadPostLikes([id])).toMatchObject({ status: "ready", likes: [{ liked: null, can_like: false }] });
    expect(mocks.publicClient).toHaveBeenCalledOnce();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("loads twelve cards with one bounded RPC, not one per card", async () => {
    const ids = Array.from({ length: 12 }, (_, index) =>
      `b02e9ce0-0a90-4e7c-a5cb-${String(index).padStart(12, "0")}`);
    mocks.rpc.mockResolvedValue({ data: ids.map((post_id) => ({ ...row, post_id })), error: null });
    expect(await loadPostLikes(ids)).toMatchObject({ status: "ready" });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_post_likes", { p_post_ids: ids });
    expect(await loadPostLikes([...ids, id])).toEqual({ status: "unavailable" });
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it.each([[], ["invalid"], [id, id]].map((ids) => ({ ids })))("rejects invalid batches before querying", async ({ ids }) => {
    expect(await loadPostLikes(ids)).toEqual({ status: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("distinguishes missing rows from service failures and invalid projections", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await loadPostLikes([id])).toEqual({ status: "ready", likes: [] });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "FAIL", message: "private-token" } });
    expect(await loadPostLikes([id])).toEqual({ status: "unavailable" });
    mocks.rpc.mockResolvedValue({ data: [row, row], error: null });
    expect(await loadPostLikes([id])).toEqual({ status: "unavailable" });
    mocks.rpc.mockResolvedValue({ data: [{ ...row, post_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" }], error: null });
    expect(await loadPostLikes([id])).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("redacts thrown transport errors for both reads and writes", async () => {
    mocks.rpc.mockRejectedValue(new Error("private-token"));
    expect(await loadPostLikes([id])).toEqual({ status: "unavailable" });
    expect(await setPostLike({ postId: id, liked: true })).toMatchObject({ status: "error" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
