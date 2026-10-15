import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LikeButton, type LikeEntry } from "./PostLikes";
vi.mock("@/actions/post-likes", () => ({ loadPostLikes: vi.fn(), setPostLike: vi.fn() }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
function render(entry?: LikeEntry) {
  return renderToStaticMarkup(<LikeButton postId={id} entry={entry} onChange={vi.fn()} retry={vi.fn()} />);
}
describe("like controls", () => {
  it("renders confirmed state and real count with a keyboard button", () => {
    const markup = render({ status: "ready", like: { post_id: id, like_count: 7, liked: true, can_like: true } });
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-label="Quitar me gusta"');
    expect(markup).toContain('aria-label="7 me gusta"');
    expect(markup).toContain('role="status"');
  });
  it("does not fabricate a zero count while loading or on failure", () => {
    expect(render()).toContain("Cargando me gusta");
    const markup = render({ status: "unavailable" });
    expect(markup).toContain("Reintentar likes");
    expect(markup).not.toContain("0 me gusta");
    expect(render({ status: "missing" })).toContain("Publicación no disponible");
  });
  it("offers login to anonymous readers and profile completion without mutation controls", () => {
    const anon = render({ status: "ready", like: { post_id: id, like_count: 3, liked: null, can_like: false } });
    expect(anon).toContain("/sign-in?redirect_url=");
    expect(anon).not.toContain("aria-pressed");
    const incomplete = render({ status: "ready", like: { post_id: id, like_count: 3, liked: false, can_like: false } });
    expect(incomplete).toContain('href="/perfil"');
    expect(incomplete).toContain("Completa tu perfil");
  });
});
