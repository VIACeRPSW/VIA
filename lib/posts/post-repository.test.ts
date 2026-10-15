import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postRepository } from "./post-repository.server";
vi.mock("server-only", () => ({}));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const path = `${"a".repeat(64)}/${id}.webp`;
function store({ state = "cleanup", expires = "2000-01-01T00:00:00Z", count = 0, fail = false } = {}) {
  const requests: string[] = [];
  const client = createClient("https://example.supabase.co", "test-key", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init);
      const pathname = new URL(request.url).pathname;
      requests.push(`${request.method} ${pathname}`);
      if (request.method === "HEAD") return new Response(null, { headers: { "content-range": `*/${count}` } });
      if (pathname.includes("/storage/")) {
        return fail ? Response.json({ message: "private-token" }, { status: 400 }) : Response.json([]);
      }
      if (pathname.endsWith("/finish_post_cleanup")) return Response.json(null);
      return Response.json([{ operation_id: id, image_path: path, state, expires_at: expires }]);
    } },
  });
  return { repository: postRepository(client, "own-user"), requests };
}
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());
describe("post cleanup repository", () => {
  it.each(["cleanup", "uploading"])("deletes an expired %s object before retiring its journal", async (state) => {
    const { repository, requests } = store({ state });
    expect(await repository.cleanup()).toBe(true);
    expect(requests).toEqual([
      "GET /rest/v1/post_uploads", "DELETE /storage/v1/object/posts",
      "POST /rest/v1/rpc/finish_post_cleanup", "HEAD /rest/v1/post_uploads",
    ]);
  });
  it("retains valid leases and reports remaining work", async () => {
    const { repository, requests } = store({ state: "uploading", expires: "2999-01-01T00:00:00Z", count: 1 });
    expect(await repository.cleanup()).toBe(false);
    expect(requests).toEqual(["GET /rest/v1/post_uploads", "HEAD /rest/v1/post_uploads"]);
  });
  it("does not erase journal evidence if Storage fails", async () => {
    const { repository, requests } = store({ fail: true });
    await expect(repository.cleanup()).rejects.toThrow("PostServiceError");
    expect(requests).not.toContain("POST /rest/v1/rpc/finish_post_cleanup");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
