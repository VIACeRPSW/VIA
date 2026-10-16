import Link from "next/link";
import type { PostWithImage } from "@/lib/posts/read-post.server";
import { PostImage } from "./PostImage";
import { LikeButton, type LikeEntry } from "./PostLikes";
import type { PostLike } from "@/lib/posts/like-contract";
import { PostShare } from "./PostShare";

export function FeedCard({ item, likes }: { item: PostWithImage; likes?: {
  entry?: LikeEntry; viewerKey: string; update: (like: PostLike) => void; retry: () => void;
} }) {
  const { post, imageUrl } = item;
  return <article className="feed-card" aria-labelledby={`feed-post-${post.id}`}>
    <header className="feed-card-header">
      <Link className="feed-author" href={`/usuario/${post.author_username}`}>
        <span className="feed-author-mark" aria-hidden="true">{post.author_display_name.slice(0, 1).toUpperCase()}</span>
        <span><strong>{post.author_display_name}</strong><small>@{post.author_username}</small></span>
      </Link>
      <span className="feed-category">{post.category_name}</span>
    </header>
    <Link href={`/post/${post.id}`} className="feed-image-link" aria-label={`Ver publicación: ${post.title}`} prefetch={false}>
      <PostImage key={imageUrl} id={post.id} title={post.title} initialUrl={imageUrl} sizes="(max-width: 672px) 100vw, 640px" />
    </Link>
    <div className="feed-card-copy">
      <h2 id={`feed-post-${post.id}`}><Link href={`/post/${post.id}`} prefetch={false}>{post.title}</Link></h2>
      {post.description && <p className="feed-caption">{post.description}</p>}
      <ul className="post-hashtags" aria-label="Hashtags">{post.hashtags.map((tag) => <li key={tag}>#{tag}</li>)}</ul>
      <div className="feed-card-footer">
        {likes && <LikeButton key={likes.viewerKey} postId={post.id} entry={likes.entry}
          onChange={likes.update} retry={likes.retry} />}
        <Link href={`/post/${post.id}#comentarios`} prefetch={false}>
          {item.commentCount === undefined ? "Ver comentarios" : item.commentCount === null
            ? "Comentarios no disponibles" : `${item.commentCount} ${item.commentCount === 1 ? "comentario" : "comentarios"}`}
        </Link>
        <PostShare postId={post.id} />
        <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString("es")}</time>
        <Link href={`/post/${post.id}`} prefetch={false}>Ver publicación <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  </article>;
}
