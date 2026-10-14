import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { prepareAvatar } from "@/lib/profiles/avatar-image.server";
import { AVATAR_MAX_BYTES, isAvatarPath, ownedAvatarPath } from "@/lib/profiles/avatar-path";

afterEach(() => vi.restoreAllMocks());
describe("avatar image preparation", () => {
  it.each(["jpeg", "png", "webp"] as const)("decodes %s and normalizes size and metadata", async (format) => {
    const bytes = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "#176b4d" } })
      .toFormat(format).toBuffer();
    const result = await prepareAvatar(new File([bytes], `avatar.${format}`, { type: `image/${format}` }));
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(384);
    expect(metadata.exif).toBeUndefined();
    expect(result.buffer.length).toBeLessThanOrEqual(AVATAR_MAX_BYTES);
  });
  it("rejects empty, oversized and unsupported inputs", async () => {
    for (const file of [
      new File([], "empty.png", { type: "image/png" }),
      new File([Buffer.alloc(AVATAR_MAX_BYTES + 1)], "large.png", { type: "image/png" }),
      new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
    ]) expect((await prepareAvatar(file)).success).toBe(false);
  });
  it("accepts exactly 2 MiB but rejects the next byte before decoding", async () => {
    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#176b4d" } }).png().toBuffer();
    const bytes = Buffer.alloc(AVATAR_MAX_BYTES);
    image.copy(bytes);
    expect((await prepareAvatar(new File([bytes], "boundary.png", { type: "image/png" }))).success).toBe(true);
  });
  it("rejects forged MIME, malformed bytes and dimensions above 4096", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#176b4d" } }).png().toBuffer();
    const wide = await sharp({ create: { width: 4097, height: 1, channels: 3, background: "#176b4d" } }).png().toBuffer();
    for (const file of [
      new File([png], "forged.jpg", { type: "image/jpeg" }),
      new File(["invalid-image"], "forged.png", { type: "image/png" }),
      new File([wide], "wide.png", { type: "image/png" }),
    ]) expect((await prepareAvatar(file)).success).toBe(false);
  });
});
describe("avatar paths", () => {
  const folder = "a".repeat(64);
  const path = `${folder}/b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a.webp`;
  const origin = "https://example.supabase.co";
  it("accepts only canonical opaque paths and the own configured origin", () => {
    expect(isAvatarPath(path)).toBe(true);
    expect(ownedAvatarPath(`${origin}/storage/v1/object/public/avatars/${path}`, origin, folder)).toBe(path);
    expect(ownedAvatarPath(null, origin, folder)).toBeNull();
    expect(isAvatarPath(`${path}\n`)).toBe(false);
  });
  it.each(["https://other.example/image.webp", "javascript:alert(1)", "not-a-url"])(
    "rejects arbitrary references", (url) => {
      expect(() => ownedAvatarPath(url, origin, folder)).toThrow();
    },
  );
  it("rejects another owner and signed URLs", () => {
    const url = `${origin}/storage/v1/object/public/avatars/${path}`;
    expect(() => ownedAvatarPath(url, origin, "b".repeat(64))).toThrow();
    expect(() => ownedAvatarPath(`${url}?token=secret`, origin, folder)).toThrow();
  });
});
