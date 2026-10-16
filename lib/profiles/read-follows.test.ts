import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProfileFollows } from "./read-follows.server";
const mocks = vi.hoisted(() => ({ publicClient: vi.fn(), serverClient: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createPublicSupabaseClient: mocks.publicClient, createServerSupabaseClient: mocks.serverClient }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const summary = { profile_id: id, username: "author_42", follower_count: 3, following_count: 2,
  viewer: "anonymous", following: null };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.publicClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.serverClient.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: summary, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("bounded follow summary reads", () => {
  it("reads one public aggregate by username or UUID without exposing relations", async () => {
    expect(await getProfileFollows({ username: "author_42" })).toEqual({ status: "ready", summary });
    expect(mocks.rpc).toHaveBeenCalledWith("get_profile_follows", { p_username: "author_42" });
    expect(await getProfileFollows({ profileId: id })).toEqual({ status: "ready", summary });
    expect(mocks.rpc).toHaveBeenLastCalledWith("get_profile_follows", { p_profile_id: id });
    expect(mocks.serverClient).not.toHaveBeenCalled();
  });
  it("uses a viewer-scoped client only for the current actor's state", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...summary, viewer: "ready", following: true }, error: null });
    expect(await getProfileFollows({ profileId: id }, true)).toMatchObject({ status: "ready" });
    expect(mocks.serverClient).toHaveBeenCalledOnce();
    expect(mocks.publicClient).not.toHaveBeenCalled();
  });
  it("distinguishes missing target from outage", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await getProfileFollows({ profileId: id })).toEqual({ status: "missing" });
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "OFFLINE", message: "private-token" } });
    expect(await getProfileFollows({ profileId: id })).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it.each([
    { ...summary, username: "other_user" }, { ...summary, follower_count: -1 },
    { ...summary, viewer: "ready", following: true }, { ...summary, follower_id: id },
  ])("rejects invalid or private public projections", async (data) => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await getProfileFollows({ username: "author_42" })).toEqual({ status: "unavailable" });
  });
  it("does not query invalid inputs or turn thrown errors into zero", async () => {
    expect(await getProfileFollows({ profileId: "bad" })).toEqual({ status: "unavailable" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockRejectedValue(new Error("private-token"));
    expect(await getProfileFollows({ profileId: id })).toEqual({ status: "unavailable" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
