"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cleanupPostUploadsAction, createPostAction, updatePostAction } from "@/actions/posts";
import { IMAGE_MIME_TYPES, initialPostState, POST_MAX_BYTES, type OwnPost } from "@/lib/posts/post-contract";

export function CreatePostForm({ operationId, categories, editing }: {
  operationId: string;
  categories: { id: string; name: string }[];
  editing?: OwnPost;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: editing?.title ?? "", description: editing?.description ?? "",
    categoryId: editing?.category_id ?? "", hashtags: editing?.hashtags.map((tag) => `#${tag}`).join(" ") ?? "",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [state, action, pending] = useActionState(async (
    previous: typeof initialPostState, data: FormData,
  ) => {
    try {
      if (data.get("intent") === "cleanup") return await cleanupPostUploadsAction();
      if (file) data.set("image", file);
      else if (editing) data.delete("image");
      return await (editing ? updatePostAction(previous, data) : createPostAction(previous, data));
    } catch (error) {
      console.error("Post request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      return { status: "error" as const, message: "No pudimos enviar la publicación. Reintenta sin recargar para recuperar la misma operación.", cleanupPending: true };
    }
  }, initialPostState);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (state.status === "success" && state.postId && !state.cleanupPending) router.push(`/post/${state.postId}`);
    else if (state.message) {
      const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid) invalid.focus();
      else statusRef.current?.focus();
    }
  }, [state, router]);
  const errors = state.fieldErrors;

  return (
    <form ref={formRef} className="profile-form" action={action} noValidate aria-busy={pending}
      onReset={(event) => event.preventDefault()}>
      <input type="hidden" name="operationId" value={operationId} />
      {editing && <>
        <input type="hidden" name="postId" value={editing.id} />
        <input type="hidden" name="version" value={editing.version} />
        <p className="field-help">Si no eliges otra imagen, se conserva la actual.</p>
      </>}
      <div className="form-field">
        <label htmlFor="post-image">{editing ? "Reemplazar imagen (opcional)" : "Imagen de la publicación"}</label>
        <input ref={imageRef} id="post-image" type="file" name="image" required={!editing} disabled={pending}
          accept={IMAGE_MIME_TYPES.join(",")} aria-describedby="post-image-help post-image-error"
          aria-invalid={Boolean(errors?.image)}
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            setPreview(selected && selected.size <= POST_MAX_BYTES && IMAGE_MIME_TYPES.includes(selected.type)
              ? URL.createObjectURL(selected) : null);
          }} />
        <p className="field-help" id="post-image-help">
          JPEG, PNG o WebP estático, hasta 5 MiB y 4096 píxeles por lado. Se publica sin metadatos.
        </p>
        <span className="field-error" id="post-image-error">{errors?.image}</span>
        {preview && <div className="post-image-frame">
          <Image src={preview} alt="Previsualización de la publicación" fill unoptimized sizes="(max-width: 672px) 100vw, 672px" />
        </div>}
        {file && <button className="button button-secondary" type="button" disabled={pending}
          onClick={() => {
            setFile(null); setPreview(null);
            if (imageRef.current) imageRef.current.value = "";
            imageRef.current?.focus();
          }}>Quitar imagen seleccionada</button>}
      </div>
      <div className="form-field">
        <label htmlFor="post-title">Título</label>
        <input id="post-title" name="title" required disabled={pending} value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          aria-describedby="post-title-help post-title-error" aria-invalid={Boolean(errors?.title)} />
        <p id="post-title-help" className="field-help">De 1 a 120 caracteres.</p>
        <span id="post-title-error" className="field-error">{errors?.title}</span>
      </div>
      <div className="form-field">
        <label htmlFor="post-category">Categoría</label>
        <select id="post-category" name="categoryId" required disabled={pending} value={draft.categoryId}
          onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
          aria-describedby="post-category-error" aria-invalid={Boolean(errors?.categoryId)}>
          <option value="">Selecciona una categoría</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <span id="post-category-error" className="field-error">{errors?.categoryId}</span>
      </div>
      <div className="form-field">
        <label htmlFor="post-hashtags">Hashtags</label>
        <input id="post-hashtags" name="hashtags" required maxLength={1000} disabled={pending} value={draft.hashtags}
          onChange={(event) => setDraft({ ...draft, hashtags: event.target.value })}
          aria-describedby="post-hashtags-help post-hashtags-error" aria-invalid={Boolean(errors?.hashtags)} />
        <p id="post-hashtags-help" className="field-help">
          De 1 a 5 etiquetas de 2 a 30 caracteres, separadas por espacios o comas. Por ejemplo: #ciencia #niños.
        </p>
        <span id="post-hashtags-error" className="field-error">{errors?.hashtags}</span>
      </div>
      <div className="form-field">
        <label htmlFor="post-description">Descripción (opcional)</label>
        <textarea id="post-description" name="description" rows={4} disabled={pending} value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          aria-describedby="post-description-help post-description-error" aria-invalid={Boolean(errors?.description)} />
        <p id="post-description-help" className="field-help">Hasta 2000 caracteres. Puedes dejarla vacía.</p>
        <span id="post-description-error" className="field-error">{errors?.description}</span>
      </div>
      {(pending || state.message) && <p ref={statusRef} className="form-status" role="status" tabIndex={-1}>
        {pending ? "Procesando publicación..." : state.message}
      </p>}
      {state.status === "unauthorized" && <Link href="/sign-in">Volver a iniciar sesión</Link>}
      {state.postId && <Link href={`/post/${state.postId}`}>Ver publicación guardada</Link>}
      <div className="profile-actions">
        <button className="button button-primary" type="submit" name="intent" value="publish" disabled={pending || (!editing && !file)}>
          {pending ? "Guardando..." : editing ? "Guardar cambios" : "Publicar"}
        </button>
        {state.cleanupPending && <button className="button button-secondary" type="submit" name="intent" value="cleanup" disabled={pending}>
          Reintentar limpieza
        </button>}
        <Link href={editing ? `/post/${editing.id}` : "/perfil"}>{editing ? "Cancelar edición" : "Volver a mi perfil"}</Link>
      </div>
    </form>
  );
}
