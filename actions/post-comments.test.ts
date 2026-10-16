import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommentAction, deleteCommentAction, loadCommentViewer, loadPostComments } from "./post-comments";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), client: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), read: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.profile }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
vi.mock("@/lib/posts/read-comments.server", () => ({ getPublicComments: mocks.read }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const input = { postId: id, operationId: id, content: " Texto " };
const created = {
  comment: { id, post_id: id, content: "Texto", created_at: "2026-10-15T23:00:00Z",
    author_username: "own_user", author_display_name: "Own" },
  commentCount: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "own" });
  mocks.profile.mockResolvedValue({ status: "found", profile: { clerkUserId: "own", username: "own_user" } });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: created, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("own comment deletion", () => {
  const deletion = { postId: id, commentId: id, confirmed: true };
  const deleted = { postId: id, commentId: id, page: { comments: [], commentCount: 0, nextCursor: null } };
  it("loads only the current actor's canonical username for controls", async () => {
    expect(await loadCommentViewer()).toEqual({ status: "ready", userId: "own", username: "own_user" });
  });
  it("deletes and retries the same ID without a client-supplied owner", async () => {
    mocks.rpc.mockResolvedValue({ data: deleted, error: null });
    expect(await deleteCommentAction(deletion)).toEqual({ status: "success", ...deleted });
    expect(await deleteCommentAction(deletion)).toEqual({ status: "success", ...deleted });
    expect(mocks.rpc.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      "delete_own_post_comment", { p_post_id: id, p_comment_id: id },
    ]));
    expect(mocks.revalidate).toHaveBeenCalledWith("/inicio");
    expect(mocks.revalidate).toHaveBeenCalledWith(`/post/${id}`);
  });
  it.each([
    { ...deletion, confirmed: false }, { postId: id, commentId: id },
    { ...deletion, commentId: "bad" }, { ...deletion, postId: "bad" },
    { ...deletion, user_id: id }, { ...deletion, role: "admin" },
  ])("requires valid IDs, explicit confirmation and no identity fields", async (payload) => {
    expect(await deleteCommentAction(payload)).toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a session before reading private permissions", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await deleteCommentAction(deletion)).toMatchObject({ status: "unauthorized" });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { profile: { status: "missing" }, status: "profile-required" },
    { profile: { status: "unauthorized" }, status: "unauthorized" },
    { profile: { status: "unavailable" }, status: "error" },
    { profile: { status: "found", profile: { clerkUserId: "other", username: "own_user" } }, status: "error" },
  ])("rejects missing, unavailable or different actor profiles", async ({ profile, status }) => {
    mocks.profile.mockResolvedValue(profile);
    expect(await deleteCommentAction(deletion)).toMatchObject({ status });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["42501", "UNAVAILABLE"])("reports SQL rejection without revalidation or raw payloads", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private-token" } });
    expect(await deleteCommentAction(deletion)).toMatchObject({ status: code === "42501" ? "unauthorized" : "error" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("distinguishes post withdrawal from an empty comments page", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await deleteCommentAction(deletion)).toMatchObject({ status: "missing" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([
    { ...deleted, commentId: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" },
    { ...deleted, postId: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" },
    { ...deleted, page: { ...deleted.page, commentCount: -1 } },
    { ...deleted, page: { ...deleted.page, comments: [created.comment], commentCount: 1 } },
    { ...deleted, page: { ...deleted.page, nextCursor: { before: created.comment.created_at, beforeId: id } } },
  ])("requires a matching authoritative deletion and page", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await deleteCommentAction(deletion)).toMatchObject({ status: "error" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("keeps lost confirmation recoverable and redacts service failures", async () => {
    mocks.rpc.mockRejectedValue(new Error("private-token"));
    expect(await deleteCommentAction(deletion)).toMatchObject({ status: "error", message: expect.stringContaining("mismo comentario") });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("surfaces failure to read viewer permissions", async () => {
    mocks.profile.mockRejectedValue(new Error("private-token"));
    expect(await loadCommentViewer()).toMatchObject({ status: "error" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
afterEach(() => vi.restoreAllMocks());
describe("comment actions", () => {
  it("normalizes input and confirms the same operation twice without choosing an actor", async () => {
    expect(await createCommentAction(input)).toEqual({ status: "success", ...created });
    expect(await createCommentAction(input)).toEqual({ status: "success", ...created });
    expect(mocks.rpc.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      "create_post_comment", { p_post_id: id, p_operation_id: id, p_content: "Texto" },
    ]));
    expect(mocks.revalidate).toHaveBeenCalledWith("/inicio");
    expect(mocks.revalidate).toHaveBeenCalledWith(`/post/${id}`);
  });
  it("rejects absent or expired authentication before accessing data", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await createCommentAction(input)).toMatchObject({ status: "unauthorized" });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, content: " \n " }, { ...input, content: "a".repeat(1001) },
    { ...input, operationId: "bad" }, { ...input, postId: "bad" }, { ...input, user_id: id },
  ])("rejects invalid content, IDs or actor fields", async (payload) => {
    expect(await createCommentAction(payload)).toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { profile: { status: "missing" }, status: "profile-required" },
    { profile: { status: "unauthorized" }, status: "unauthorized" },
    { profile: { status: "unavailable" }, status: "error" },
    { profile: { status: "found", profile: { clerkUserId: "other", username: "other" } }, status: "error" },
  ])("requires the persisted profile to belong to the session", async ({ profile, status }) => {
    mocks.profile.mockResolvedValue(profile);
    expect(await createCommentAction(input)).toMatchObject({ status });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { code: "23505", status: "conflict" }, { code: "42501", status: "unauthorized" },
    { code: "P0002", status: "error" }, { code: "UNAVAILABLE", status: "error" },
  ])("does not claim success for %s", async ({ code, status }) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private-token" } });
    expect(await createCommentAction(input)).toMatchObject({ status });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it.each([
    { ...created, commentCount: 0 },
    { ...created, comment: { ...created.comment, content: "Other" } },
    { ...created, comment: { ...created.comment, author_username: "other_user" } },
    { ...created, comment: { ...created.comment, post_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" } },
  ])("requires an authoritative matching confirmation", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await createCommentAction(input)).toMatchObject({ status: "error" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("redacts thrown service errors and does not discard the operation", async () => {
    mocks.rpc.mockRejectedValue(new Error("private-token"));
    expect(await createCommentAction(input)).toMatchObject({ status: "error", message: expect.stringContaining("mismo envío") });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("delegates public reads with the exact timestamp cursor", async () => {
    const cursor = { before: "2026-10-15T23:00:00.123456+00:00", beforeId: id };
    mocks.read.mockResolvedValue({ status: "missing" });
    expect(await loadPostComments(id, cursor)).toEqual({ status: "missing" });
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(id, cursor);
  });
});
