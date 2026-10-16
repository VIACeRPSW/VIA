import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPostShareLink, copyPostLink, getPostShareLink, sharePostLink } from "./share-contract";

const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("public post share URLs", () => {
  it.each(["https://via.example", "https://via.example/"])("builds only the canonical post URL from %s", (origin) => {
    expect(buildPostShareLink(id.toUpperCase(), origin, "production")).toEqual({
      status: "ready", url: `https://via.example/post/${id}`,
    });
  });
  it.each([undefined, ""])("defaults to localhost only in development", (origin) => {
    expect(buildPostShareLink(id, origin, "development")).toEqual({ status: "ready", url: `http://localhost:3000/post/${id}` });
    expect(buildPostShareLink(id, origin, "production")).toMatchObject({ status: "unavailable" });
    expect(buildPostShareLink(id, origin, "test")).toMatchObject({ status: "unavailable" });
  });
  it.each([
    "http://via.example", "javascript:alert(1)", "file:///tmp/app", "not a URL",
    "https://user:password@via.example", "https://via.example/path", "https://via.example/?token=private",
    "https://via.example/#private", "https://via.example/?", "https://via.example/#",
    "https://via.example\\@evil.example", "https://via.example/\n", " https://via.example",
    "https://localhost", "https://dev.localhost", "https://127.0.0.1", "https://[::1]", "https://0.0.0.0",
  ])("rejects noncanonical or disallowed production origins: %s", (origin) => {
    expect(buildPostShareLink(id, origin, "production")).toMatchObject({ status: "unavailable" });
  });
  it.each(["http://localhost:3000", "http://127.0.0.1:3001", "http://[::1]:3000"])("allows development loopback %s", (origin) => {
    expect(buildPostShareLink(id, origin, "development")).toEqual({ status: "ready", url: `${origin}/post/${id}` });
  });
  it.each(["bad", `${id}?token=secret`, `${id}/../../perfil`, "//evil.example", ""])("rejects manipulated post IDs", (postId) => {
    expect(buildPostShareLink(postId, "https://via.example", "production")).toMatchObject({ status: "unavailable" });
  });
  it("uses the configured application origin, never a browser/request origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ORIGIN", "https://configured.example");
    expect(getPostShareLink(id)).toEqual({ status: "ready", url: `https://configured.example/post/${id}` });
  });
});

describe("browser share results", () => {
  const url = `https://via.example/post/${id}`;
  it("announces copying only after writeText resolves", async () => {
    let finish: () => void = () => {};
    const clipboard = { writeText: vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })) };
    const result = copyPostLink(url, clipboard);
    expect(clipboard.writeText).toHaveBeenCalledExactlyOnceWith(url);
    finish();
    expect(await result).toMatchObject({ status: "copied", message: "Enlace copiado." });
  });
  it("offers manual copying when Clipboard is absent", async () => {
    expect(await copyPostLink(url, undefined)).toMatchObject({ status: "unsupported", message: expect.stringContaining("manualmente") });
  });
  it("does not report copy success for a denied permission and redacts errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const clipboard = { writeText: vi.fn().mockRejectedValue(new Error("private-token")) };
    expect(await copyPostLink(url, clipboard)).toMatchObject({ status: "error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
  });
  it("shares just the canonical URL, without image, title, identity or tokens", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await sharePostLink(url, share)).toMatchObject({ status: "shared" });
    expect(share).toHaveBeenCalledExactlyOnceWith({ url });
  });
  it("distinguishes absent native API, cancellation and errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sharePostLink(url, undefined)).toMatchObject({ status: "unsupported" });
    expect(await sharePostLink(url, vi.fn().mockRejectedValue(new DOMException("Cancelled", "AbortError"))))
      .toMatchObject({ status: "cancelled" });
    expect(log).not.toHaveBeenCalled();
    expect(await sharePostLink(url, vi.fn().mockRejectedValue(new DOMException("private-token", "NotAllowedError"))))
      .toMatchObject({ status: "error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("private-token");
  });
});
