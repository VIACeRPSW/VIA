import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PostList } from "./PostList";
import { FeedCard } from "./FeedCard";
import type { PostWithImage } from "@/lib/posts/read-post.server";
vi.mock("@/actions/post-feed", () => ({ refreshPostImage: vi.fn(), loadFeedPage: vi.fn() }));
vi.mock("@/actions/post-likes", () => ({ loadPostLikes: vi.fn(), setPostLike: vi.fn() }));
const item: PostWithImage = {
  imageUrl: "https://example.supabase.co/image.webp?token=test",
  post: {
    id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a", title: "Una idea visual",
    description: "Esta descripción solo pertenece al feed y al detalle.",
    category_id: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b", category_name: "Arte",
    hashtags: ["arte"], image_path: "opaque", author_username: "own_user",
    author_display_name: "Autora", author_avatar_url: null,
    created_at: "2026-10-15T12:00:00Z", updated_at: "2026-10-15T12:00:00Z",
  },
};
describe("social post presentation", () => {
  it("renders a gallery tile without visible title, caption or author text", () => {
    const markup = renderToStaticMarkup(<PostList result={{ status: "ready", posts: [item], nextCursor: null }} basePath="/imagenes" />);
    expect(markup).toContain('aria-label="Ver publicación: Una idea visual"');
    expect(markup).toContain('alt="Una idea visual"');
    expect(markup).not.toContain("<h2");
    expect(markup).not.toContain(item.post.description);
    expect(markup).not.toContain(item.post.author_display_name);
  });
  it("keeps author, title, caption and text hashtags in the feed", () => {
    const markup = renderToStaticMarkup(<FeedCard item={item} />);
    expect(markup).toContain("feed-card-header");
    expect(markup).toContain(item.post.description);
    expect(markup).toContain(item.post.author_display_name);
    expect(markup).toContain("#arte");
    expect(markup).not.toContain("/_next/image");
  });
  it("shows read failures rather than pretending a gallery is empty", () => {
    const markup = renderToStaticMarkup(<PostList result={{ status: "unavailable" }} basePath="/imagenes" />);
    expect(markup).toContain("No pudimos cargar");
    expect(markup).not.toContain("Todavía no hay");
  });
  it("links feed comment counts to the detail without adding gallery controls", () => {
    const markup = renderToStaticMarkup(<FeedCard item={{ ...item, commentCount: 2 }} />);
    expect(markup).toContain(`href="/post/${item.post.id}#comentarios"`);
    expect(markup).toContain("2 comentarios");
    const unavailable = renderToStaticMarkup(<FeedCard item={{ ...item, commentCount: null }} />);
    expect(unavailable).toContain("Comentarios no disponibles");
    expect(unavailable).not.toContain("0 comentarios");
  });
});
