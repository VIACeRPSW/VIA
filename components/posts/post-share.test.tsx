import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostShare } from "./PostShare";

const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
afterEach(() => vi.unstubAllEnvs());
describe("public share control", () => {
  it("provides a labeled dialog and manual fallback without requiring authentication", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://via.example");
    const markup = renderToStaticMarkup(<PostShare postId={id} />);
    expect(markup).toContain("Compartir");
    expect(markup).toContain(`aria-labelledby="share-title-${id}"`);
    expect(markup).toContain(`value="https://via.example/post/${id}"`);
    expect(markup).toContain("Copiar enlace");
    expect(markup).toContain("manualmente");
    expect(markup).toContain("readOnly");
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain("Enlace copiado.");
    expect(markup).not.toContain("token=");
    expect(markup).not.toContain("sign-in");
  });
  it("fails visibly and does not offer a guessed link with invalid configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://via.example/?token=secret");
    const markup = renderToStaticMarkup(<PostShare postId={id} />);
    expect(markup).toContain("no está permitido");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("<dialog");
    expect(markup).not.toContain("secret");
  });
});
