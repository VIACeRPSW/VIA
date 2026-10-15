import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommentComposer, CommentList, PostComments } from "./PostComments";
vi.mock("@/actions/post-comments", () => ({ createCommentAction: vi.fn(), loadPostComments: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useAuth: () => ({ isLoaded: true, userId: null }) }));
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const row = { id, post_id: id, content: '<img src=x onerror="alert(1)">', created_at: "2026-10-15T23:00:00Z",
  author_username: "public_author", author_display_name: "Public" };
describe("comment presentation", () => {
  it("renders HTML-like content inertly and links only the public author", () => {
    const markup = renderToStaticMarkup(<CommentList comments={[row]} />);
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).toContain('href="/usuario/public_author"');
    expect(markup).toContain('aria-label="Comentarios de la publicación"');
    expect(markup).not.toContain("clerk_user_id");
  });
  it("provides a labeled plain-text composer without a UTF-16 maxlength", () => {
    const markup = renderToStaticMarkup(<CommentComposer postId={id} onCreated={vi.fn()} />);
    expect(markup).toContain("Escribe un comentario");
    expect(markup).toContain("1000 caracteres");
    expect(markup).toContain('name="content"');
    expect(markup).not.toContain("maxLength");
    expect(markup).not.toContain("maxlength");
    expect(markup).toContain('role="status"');
  });
  it("allows anonymous reading but offers login rather than a composer", () => {
    const markup = renderToStaticMarkup(<PostComments postId={id} initial={{
      status: "ready", page: { comments: [row], commentCount: 1, nextCursor: null },
    }} />);
    expect(markup).toContain("Comentarios (1)");
    expect(markup).toContain("Inicia sesión para comentar");
    expect(markup).not.toContain("<textarea");
    expect(markup).not.toContain("Todavía no hay");
  });
  it("distinguishes a failed read from an empty successful list", () => {
    const failure = renderToStaticMarkup(<PostComments postId={id} initial={{ status: "unavailable" }} />);
    expect(failure).toContain("No pudimos cargar los comentarios");
    expect(failure).toContain("Reintentar comentarios");
    expect(failure).not.toContain("Todavía no hay");
    const empty = renderToStaticMarkup(<PostComments postId={id} initial={{
      status: "ready", page: { comments: [], commentCount: 0, nextCursor: null },
    }} />);
    expect(empty).toContain("Todavía no hay comentarios.");
  });
});
