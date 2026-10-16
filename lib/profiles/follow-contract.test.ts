import { describe, expect, it } from "vitest";
import { followInputSchema, followReadInputSchema, followSummarySchema } from "./follow-contract";
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
describe("profile follow contracts", () => {
  it("accepts a strict desired boolean state and stable UUID only", () => {
    expect(followInputSchema.parse({ profileId: id, following: false })).toEqual({ profileId: id, following: false });
    for (const payload of [{ profileId: id, following: "true" }, { profileId: id, following: true, follower_id: id },
      { profileId: id, following: true, role: "admin" }, { profileId: "bad", following: true }, { profileId: id }]) {
      expect(followInputSchema.safeParse(payload).success).toBe(false);
    }
  });
  it("reads by exactly one canonical username or stable UUID", () => {
    expect(followReadInputSchema.parse({ username: "author_42" })).toEqual({ username: "author_42" });
    expect(followReadInputSchema.parse({ profileId: id })).toEqual({ profileId: id });
    for (const payload of [{}, { profileId: id, username: "author_42" }, { username: "Author" }, { username: "../bad" }]) {
      expect(followReadInputSchema.safeParse(payload).success).toBe(false);
    }
  });
  it("permits personal state only for an eligible current actor and forbids private extras", () => {
    const summary = { profile_id: id, username: "author_42", follower_count: 0, following_count: 1,
      viewer: "ready", following: false };
    expect(followSummarySchema.safeParse(summary).success).toBe(true);
    for (const payload of [{ ...summary, viewer: "anonymous" }, { ...summary, viewer: "self" },
      { ...summary, follower_count: -1 }, { ...summary, following_count: 0.5 },
      { ...summary, follower_id: id }, { ...summary, clerk_user_id: "private" }]) {
      expect(followSummarySchema.safeParse(payload).success).toBe(false);
    }
  });
  it.each(["anonymous", "expired", "profile-required", "self"])("returns no personal relation for %s", (viewer) => {
    expect(followSummarySchema.safeParse({
      profile_id: id, username: "author_42", follower_count: 2, following_count: 3, viewer, following: null,
    }).success).toBe(true);
  });
});
