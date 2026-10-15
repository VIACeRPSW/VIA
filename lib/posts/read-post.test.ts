import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getOwnPostCount, getPostCategories, getPublicFeed, getPublicPost, getPublicPosts } from "./read-post.server";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  client: vi.fn(), read: vi.fn(), sign: vi.fn(), categories: vi.fn(), rpc: vi.fn(),
  list: vi.fn(), own: vi.fn(), count: vi.fn(), commentCounts: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createPublicSupabaseClient: mocks.client, createServerSupabaseClient: mocks.own,
}));
vi.mock("@/lib/posts/read-comments.server", () => ({ getPostCommentCounts: mocks.commentCounts }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const path = `${"a".repeat(64)}/${id}.webp`;
const origin = "https://example.supabase.co";
const row = {
  id, title: "Title", description: "", hashtags: ["ciencia"], image_path: path,
  category_id: id, category_name: "Ciencia", created_at: "2026-10-15T12:00:00Z",
  updated_at: "2026-10-15T12:00:00Z", author_username: "test_user",
  author_display_name: "Test", author_avatar_url: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", origin);
  mocks.client.mockReturnValue({
    rpc: mocks.rpc,
    storage: { from: () => ({ createSignedUrl: mocks.sign }) },
    from: () => ({ select: () => ({ order: mocks.categories }) }),
  });
  mocks.rpc.mockImplementation(() => Object.assign(mocks.list(), { maybeSingle: mocks.read }));
  mocks.list.mockResolvedValue({ data: [], error: null });
  mocks.own.mockResolvedValue({ from: () => ({ select: mocks.count }) });
  mocks.count.mockResolvedValue({ count: 1, error: null });
  mocks.read.mockResolvedValue({ data: row, error: null });
  mocks.sign.mockResolvedValue({ data: { signedUrl: `${origin}/storage/v1/object/sign/posts/${path}?token=private` }, error: null });
  mocks.categories.mockResolvedValue({ data: [{ id, name: "Ciencia" }], error: null });
  mocks.commentCounts.mockResolvedValue({ status: "ready", counts: [{ post_id: id, comment_count: 2 }] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("public posts", () => {
  it("adds batched public comment counts only to the feed, not galleries", async () => {
    mocks.list.mockResolvedValue({ data: [row], error: null });
    expect(await getPublicPosts()).toMatchObject({ status: "ready" });
    expect(mocks.commentCounts).not.toHaveBeenCalled();
    expect(await getPublicFeed()).toMatchObject({ status: "ready", posts: [{ commentCount: 2 }] });
    expect(mocks.commentCounts).toHaveBeenCalledExactlyOnceWith([id]);
    mocks.commentCounts.mockResolvedValue({ status: "unavailable" });
    expect(await getPublicFeed()).toMatchObject({ status: "ready", posts: [{ commentCount: null }] });
  });
  it("uses a 60-second signed image reference", async () => {
    expect(await getPublicPost(id)).toMatchObject({ status: "found", post: row, imageUrl: expect.stringContaining("?token=") });
    expect(mocks.sign).toHaveBeenCalledWith(path, 60);
  });
  it("does not query malformed IDs and distinguishes missing from failure", async () => {
    expect(await getPublicPost("invalid")).toEqual({ status: "missing" });
    expect(mocks.client).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({ data: null, error: null });
    expect(await getPublicPost(id)).toEqual({ status: "missing" });
    mocks.read.mockResolvedValue({ data: null, error: { message: "private-token" } });
    expect(await getPublicPost(id)).toEqual({ status: "unavailable" });
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("preserves post text when image signing fails", async () => {
    mocks.sign.mockResolvedValue({ data: null, error: { name: "StorageError" } });
    expect(await getPublicPost(id)).toMatchObject({ status: "found", imageUrl: null });
  });
  it.each([
    `https://other.example/storage/v1/object/sign/posts/${path}?token=private`,
    `${origin}/storage/v1/object/public/posts/${path}?token=private`,
    `${origin}/storage/v1/object/sign/posts/${path}`,
    `${origin}/storage/v1/object/sign/posts/${path}?token=private#fragment`,
    `http://example.supabase.co/storage/v1/object/sign/posts/${path}?token=private`,
  ])("rejects an unsafe signed reference", async (signedUrl) => {
    mocks.sign.mockResolvedValue({ data: { signedUrl }, error: null });
    expect(await getPublicPost(id)).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
  });
  it("rejects malformed projections before requesting a signature", async () => {
    mocks.read.mockResolvedValue({ data: { ...row, image_path: "../foreign" }, error: null });
    expect(await getPublicPost(id)).toEqual({ status: "unavailable" });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("requires a nonempty validated category catalog", async () => {
    expect(await getPostCategories()).toMatchObject({ status: "ready", categories: [{ id, name: "Ciencia" }] });
    mocks.categories.mockResolvedValue({ data: [], error: null });
    expect(await getPostCategories()).toEqual({ status: "unavailable" });
  });
  it("shows an empty list only after a successful read", async () => {
    expect(await getPublicPosts()).toEqual({ status: "ready", posts: [], nextCursor: null });
    mocks.list.mockResolvedValue({ data: null, error: { message: "private-token" } });
    expect(await getPublicPosts()).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("passes author and both cursor fields without losing timestamp precision", async () => {
    const cursor = { before: "2026-10-15T12:00:00.123456+00:00", beforeId: id };
    mocks.list.mockResolvedValue({ data: [{ ...row, created_at: cursor.before }], error: null });
    expect(await getPublicPosts({ authorUsername: "test_user", cursor })).toMatchObject({
      status: "ready", posts: [{ post: { created_at: cursor.before } }], nextCursor: null,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_public_posts", {
      p_author_username: "test_user", p_before_created_at: cursor.before, p_before_id: id,
    });
  });
  it("uses the last of 12 ordered rows for the next page", async () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
      ...row, id: `b02e9ce0-0a90-4e7c-a5cb-${String(12 - index).padStart(12, "0")}`,
    }));
    mocks.list.mockResolvedValue({ data: rows, error: null });
    expect(await getPublicPosts()).toMatchObject({
      status: "ready", nextCursor: { before: row.created_at, beforeId: rows[11].id },
    });
  });
  it("rejects invalid list input before querying and oversized responses before signing", async () => {
    expect(await getPublicPosts({ authorUsername: "foreign/../" })).toEqual({ status: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue({ data: Array.from({ length: 13 }, () => row), error: null });
    expect(await getPublicPosts()).toEqual({ status: "unavailable" });
    expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("does not turn a count query failure into a zero count", async () => {
    expect(await getOwnPostCount()).toEqual({ status: "ready", count: 1 });
    mocks.count.mockResolvedValue({ count: null, error: null });
    expect(await getOwnPostCount()).toEqual({ status: "unavailable" });
  });
});
