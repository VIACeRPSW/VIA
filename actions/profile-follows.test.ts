import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadProfileFollows, setProfileFollow } from "./profile-follows";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), profile: vi.fn(), client: vi.fn(), rpc: vi.fn(), read: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/profiles/read-profile.server", () => ({ getOwnProfile: mocks.profile }));
vi.mock("@/lib/profiles/read-follows.server", () => ({ getProfileFollows: mocks.read }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const ownId = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b";
const summary = { profile_id: id, username: "renamed_author", follower_count: 1, following_count: 0,
  viewer: "ready", following: true };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ isAuthenticated: true, userId: "actor" });
  mocks.profile.mockResolvedValue({ status: "found", profile: { id: ownId, clerkUserId: "actor", username: "old_actor" } });
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: { summary, actor_username: "renamed_actor" }, error: null });
  mocks.read.mockResolvedValue({ status: "ready", summary });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
describe("profile follow actions", () => {
  it("sets and retries the desired state and revalidates current canonical names, not the feed", async () => {
    for (let index = 0; index < 2; index++) {
      expect(await setProfileFollow({ profileId: id, following: true })).toEqual({ status: "success", summary });
    }
    expect(mocks.rpc.mock.calls).toEqual(Array.from({ length: 2 }, () => [
      "set_profile_follow", { p_profile_id: id, p_following: true },
    ]));
    expect(mocks.revalidate).toHaveBeenCalledWith("/perfil");
    expect(mocks.revalidate).toHaveBeenCalledWith("/usuario/renamed_actor");
    expect(mocks.revalidate).toHaveBeenCalledWith("/usuario/renamed_author");
    expect(mocks.revalidate).not.toHaveBeenCalledWith("/inicio");
  });
  it("does not mutate without an authenticated actor", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await setProfileFollow({ profileId: id, following: true })).toMatchObject({ status: "unauthorized" });
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { profileId: id, following: "true" }, { profileId: "bad", following: false },
    { profileId: id, following: true, follower_id: ownId }, { profileId: id, following: true, role: "admin" },
  ])("rejects malformed or spoofed mutations", async (input) => {
    expect(await setProfileFollow(input)).toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { profile: { status: "missing" }, status: "profile-required" },
    { profile: { status: "unauthorized" }, status: "unauthorized" },
    { profile: { status: "unavailable" }, status: "error" },
    { profile: { status: "found", profile: { id: ownId, clerkUserId: "other" } }, status: "error" },
  ])("requires the current actor's stored profile", async ({ profile, status }) => {
    mocks.profile.mockResolvedValue(profile);
    expect(await setProfileFollow({ profileId: id, following: true })).toMatchObject({ status });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("forbids self-follow even for a false desired state", async () => {
    expect(await setProfileFollow({ profileId: ownId, following: false })).toMatchObject({ status: "invalid" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { code: "42501", status: "unauthorized" }, { code: "P0002", status: "missing" }, { code: "UNAVAILABLE", status: "error" },
  ])("does not claim success for rejected mutations", async ({ code, status }) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message: "private-token" } });
    expect(await setProfileFollow({ profileId: id, following: true })).toMatchObject({ status });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it.each([
    { ...summary, following: false }, { ...summary, profile_id: ownId },
    { ...summary, follower_count: -1 }, { ...summary, viewer: "self", following: null },
  ])("requires a matching authoritative confirmation", async (changed) => {
    mocks.rpc.mockResolvedValue({ data: { summary: changed, actor_username: "own_user" }, error: null });
    expect(await setProfileFollow({ profileId: id, following: true })).toMatchObject({ status: "error" });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("retains honest failure on a lost response and redacts thrown service errors", async () => {
    mocks.rpc.mockRejectedValue(new Error("private-token"));
    expect(await setProfileFollow({ profileId: id, following: true })).toMatchObject({ status: "error",
      message: expect.stringContaining("mismo estado") });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("stamps private reads with the actual actor to reject stale account responses", async () => {
    expect(await loadProfileFollows({ profileId: id })).toEqual({ status: "ready", summary, actorKey: "actor" });
    expect(mocks.read).toHaveBeenCalledWith({ profileId: id }, true);
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    mocks.read.mockResolvedValue({ status: "ready", summary: { ...summary, viewer: "anonymous", following: null } });
    expect(await loadProfileFollows({ username: "renamed_author" })).toMatchObject({ actorKey: null });
    expect(mocks.read).toHaveBeenLastCalledWith({ username: "renamed_author" }, false);
  });
  it("does not accept personal state in an anonymous response", async () => {
    mocks.auth.mockResolvedValue({ isAuthenticated: false, userId: null });
    expect(await loadProfileFollows({ profileId: id })).toEqual({ status: "unavailable", actorKey: null });
  });
});
