import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { avatarFolder, avatarRepository, getAvatarCleanupStatus } from "@/lib/profiles/avatar-repository.server";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.createClient }));
const origin = "https://example.supabase.co";
const user = "fixture-user";
const folder = avatarFolder(user);
const path = `${folder}/12345678-1234-1234-1234-123456789abc.webp`;
const url = `${origin}/storage/v1/object/public/avatars/${path}`;
type Task = { object_path: string; state: "uploading" | "cleanup"; expires_at: string };
function store({
  active = null, tasks = [], count = 0, failure,
}: { active?: string | null; tasks?: Task[]; count?: number; failure?: "storage" | "journal" | "lookup" } = {}) {
  const requests: { pathname: string; method: string }[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input, init) => {
    const request = new Request(input, init);
    const pathname = new URL(request.url).pathname;
    requests.push({ pathname, method: request.method });
    if ((failure === "storage" && pathname.includes("/storage/"))
      || (failure === "journal" && request.method === "DELETE" && pathname.includes("/rest/"))
      || (failure === "lookup" && pathname.endsWith("/profiles"))) {
      return Response.json({ code: "TEST_FAILURE", message: "private-token" }, { status: 500 });
    }
    if (request.method === "HEAD") {
      return new Response(null, { headers: { "content-range": `*/${count}` } });
    }
    if (pathname.endsWith("/profiles")) return Response.json([{ avatar_url: active }]);
    if (request.method === "DELETE") return Response.json([]);
    return Response.json(tasks);
  });
  const client = createClient(origin, "test-key", {
    global: { fetch: fetcher }, auth: { persistSession: false },
  });
  return { repository: avatarRepository(client, user), client, requests };
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", origin);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("durable avatar cleanup", () => {
  it.each(["cleanup", "uploading"] as const)("deletes an expired %s object before its journal", async (state) => {
    const { repository, requests } = store({ tasks: [{ object_path: path, state, expires_at: "2000-01-01T00:00:00Z" }] });
    expect(await repository.cleanup()).toBe(true);
    expect(requests.filter((request) => request.method === "DELETE").map((request) => request.pathname))
      .toEqual(["/storage/v1/object/avatars", "/rest/v1/avatar_cleanup_tasks"]);
  });
  it.each([
    { active: url, state: "cleanup" as const, expires_at: "2000-01-01T00:00:00Z" },
    { active: null, state: "uploading" as const, expires_at: "2999-01-01T00:00:00Z" },
  ])("retains active references and valid upload leases", async ({ active, state, expires_at }) => {
    const { repository, requests } = store({ active, count: 1, tasks: [{ object_path: path, state, expires_at }] });
    expect(await repository.cleanup()).toBe(false);
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
  });
  it.each(["storage", "journal", "lookup"] as const)("reports and redacts %s failures", async (failure) => {
    const { repository, requests } = store({
      failure, tasks: [{ object_path: path, state: "cleanup", expires_at: "2000-01-01T00:00:00Z" }],
    });
    expect(await repository.cleanup()).toBe(false);
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
    if (failure === "storage") {
      expect(requests.some((request) => request.method === "DELETE" && request.pathname.includes("/rest/"))).toBe(false);
    }
  });
  it("rejects malformed or foreign journal paths before deletion", async () => {
    const { repository, requests } = store({
      tasks: [{ object_path: "foreign/path.webp", state: "cleanup", expires_at: "2000-01-01T00:00:00Z" }],
    });
    expect(await repository.cleanup()).toBe(false);
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
  });
  it("reports remaining work, rather than declaring a partial batch complete", async () => {
    expect(await store({ count: 1 }).repository.cleanup()).toBe(false);
  });
  it.each([0, 1])("reads observable cleanup status with count %s", async (count) => {
    mocks.createClient.mockResolvedValue(store({ count }).client);
    expect(await getAvatarCleanupStatus()).toEqual({ pending: count > 0, unavailable: false });
  });
  it("distinguishes unavailable status from an empty journal", async () => {
    mocks.createClient.mockRejectedValue(new Error("private-token"));
    expect(await getAvatarCleanupStatus()).toEqual({ pending: false, unavailable: true });
    expect(console.error).toHaveBeenCalled();
  });
});
