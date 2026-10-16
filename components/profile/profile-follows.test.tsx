import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FollowControls, ProfileFollows } from "./ProfileFollows";
import type { FollowSummary } from "@/lib/profiles/follow-contract";
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true, userId: null }) }));
vi.mock("@/actions/profile-follows", () => ({ loadProfileFollows: vi.fn(), setProfileFollow: vi.fn() }));
const summary: FollowSummary = {
  profile_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a", username: "author_42",
  follower_count: 4, following_count: 2, viewer: "ready", following: false,
};
describe("profile follow controls", () => {
  it("renders a real pressed state and desired action for another author", () => {
    const props = { disabled: false, onConfirmed: vi.fn(), onMissing: vi.fn() };
    expect(renderToStaticMarkup(<FollowControls {...props} summary={summary} />)).toContain('aria-pressed="false"');
    const following = renderToStaticMarkup(<FollowControls {...props} summary={{ ...summary, following: true }} />);
    expect(following).toContain("Dejar de seguir");
    expect(following).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<FollowControls {...props} summary={summary} disabled />)).toContain("disabled");
  });
  it.each(["self", "anonymous", "expired", "profile-required"] as const)("does not offer an active follow for %s", (viewer) => {
    const markup = renderToStaticMarkup(<FollowControls summary={{ ...summary, viewer, following: null }} disabled={false}
      onConfirmed={vi.fn()} onMissing={vi.fn()} />);
    expect(markup).not.toContain("<button");
    expect(markup).toContain(viewer === "self" ? "Este es tu perfil" : viewer === "profile-required" ? "/perfil" : "/sign-in");
  });
  it("shows public counts but no relationship lists", () => {
    const markup = renderToStaticMarkup(<ProfileFollows username="author_42" initial={{
      status: "ready", summary: { ...summary, viewer: "anonymous", following: null },
    }} />);
    expect(markup).toContain("<dd>4</dd>");
    expect(markup).toContain("<dd>2</dd>");
    expect(markup).toContain("Inicia sesión para seguir");
    expect(markup).not.toContain("follower_id");
  });
  it("does not present an unavailable count as zero", () => {
    const markup = renderToStaticMarkup(<ProfileFollows username="author_42" initial={{ status: "unavailable" }} />);
    expect(markup).toContain("No pudimos cargar los conteos");
    expect(markup).not.toContain("<dd>0</dd>");
  });
  it("resets scoped state if a renamed username is reused by a different profile", () => {
    const first = ProfileFollows({ username: "author_42", initial: { status: "ready", summary } });
    const next = ProfileFollows({ username: "author_42", initial: { status: "ready",
      summary: { ...summary, profile_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b" } } });
    expect(first.key).not.toEqual(next.key);
  });
});
