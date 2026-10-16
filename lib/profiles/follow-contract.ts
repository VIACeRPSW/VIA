import { z } from "zod";
import { isCanonicalUsername } from "./read-profile";

const usernameSchema = z.string().refine(isCanonicalUsername);
export const followReadInputSchema = z.union([
  z.object({ username: usernameSchema }).strict(),
  z.object({ profileId: z.uuid() }).strict(),
]);
export const followInputSchema = z.object({ profileId: z.uuid(), following: z.boolean() }).strict();
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const followSummarySchema = z.object({
  profile_id: z.uuid(), username: usernameSchema,
  follower_count: countSchema, following_count: countSchema,
  following: z.boolean().nullable(),
  viewer: z.enum(["anonymous", "expired", "profile-required", "self", "ready"]),
}).strict().refine((row) => row.viewer === "ready" ? row.following !== null : row.following === null);
export const followChangedSchema = z.object({ actor_username: usernameSchema, summary: followSummarySchema }).strict();
export type FollowSummary = z.infer<typeof followSummarySchema>;
export type FollowReadResult =
  | { status: "ready"; summary: FollowSummary }
  | { status: "missing" | "unavailable" };
export type FollowViewerResult = FollowReadResult & { actorKey: string | null };
export type FollowActionResult =
  | { status: "success"; summary: FollowSummary }
  | { status: "invalid" | "unauthorized" | "profile-required" | "missing" | "error"; message: string };
