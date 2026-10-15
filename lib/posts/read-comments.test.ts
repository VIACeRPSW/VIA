import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPostCommentCounts, getPublicComments } from "./read-comments.server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createPublicSupabaseClient: mocks.client }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const row = { id, post_id: id, content: "Plain text", created_at: "2026-10-15T23:00:00.123456+00:00",
  author_username: "public_author", author_display_name: "Public" };
const page = { comments: [row], commentCount: 1, nextCursor: null };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: page, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("public comments", () => {
  it("returns only the public projection and preserves timestamp precision", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...page, comments: [{ ...row, clerk_user_id: "private", user_id: id }] }, error: null });
    expect(await getPublicComments(id)).toEqual({ status: "ready", page });
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_post_comments", { p_post_id: id });
  });
  it("passes both cursor fields without converting them to Date", async () => {
    const cursor = { before: row.created_at, beforeId: id };
    expect(await getPublicComments(id, cursor)).toMatchObject({ status: "ready" });
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_post_comments", {
      p_post_id: id, p_before_created_at: cursor.before, p_before_id: id,
    });
  });
  it("distinguishes a successful empty page, missing post and read failure", async () => {
    mocks.rpc.mockResolvedValue({ data: { comments: [], commentCount: 0, nextCursor: null }, error: null });
    expect(await getPublicComments(id)).toMatchObject({ status: "ready", page: { comments: [] } });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getPublicComments(id)).toEqual({ status: "missing" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "FAIL", message: "private-token" } });
    expect(await getPublicComments(id)).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("validates IDs and cursors before querying", async () => {
    expect(await getPublicComments("invalid")).toEqual({ status: "unavailable" });
    expect(await getPublicComments(id, { before: "bad", beforeId: id })).toEqual({ status: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { ...page, comments: [row, row] },
    { ...page, commentCount: 0 },
    { ...page, comments: [{ ...row, post_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" }] },
    { ...page, nextCursor: { before: row.created_at, beforeId: id } },
    { ...page, comments: Array.from({ length: 13 }, () => row) },
  ])("rejects contradictory page projections", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getPublicComments(id)).toEqual({ status: "unavailable" });
  });
  it("counts twelve posts with one RPC and rejects a thirteenth", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `b02e9ce0-0a90-4e7c-a5cb-${String(index).padStart(12, "0")}`);
    const counts = ids.map((post_id) => ({ post_id, comment_count: 0 }));
    mocks.rpc.mockResolvedValue({ data: counts, error: null });
    expect(await getPostCommentCounts(ids)).toEqual({ status: "ready", counts });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_post_comment_counts", { p_post_ids: ids });
    expect(await getPostCommentCounts([...ids, id])).toEqual({ status: "unavailable" });
    expect(mocks.rpc).toHaveBeenCalledOnce();
  });
  it("does not turn count errors or malformed results into zero", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "FAIL" } });
    expect(await getPostCommentCounts([id])).toEqual({ status: "unavailable" });
    mocks.rpc.mockResolvedValue({ data: [{ post_id: id, comment_count: -1 }], error: null });
    expect(await getPostCommentCounts([id])).toEqual({ status: "unavailable" });
  });
});
