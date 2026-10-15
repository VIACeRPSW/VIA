import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { preparePostImage } from "./post-image.server";
import { POST_MAX_BYTES } from "./post-contract";

afterEach(() => vi.restoreAllMocks());
const image = (width = 16, height = 8) => sharp({
  create: { width, height, channels: 3, background: "#176b4d" },
});
describe("post image", () => {
  it.each(["jpeg", "png", "webp"] as const)("normalizes %s without metadata or enlargement", async (format) => {
    const bytes = await image().withMetadata().toFormat(format).toBuffer();
    const result = await preparePostImage(new File([bytes], `image.${format}`, { type: `image/${format}` }));
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata).toMatchObject({ format: "webp", width: 16, height: 8 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });
  it("accepts exactly 5 MiB and rejects the next byte", async () => {
    const padded = Buffer.alloc(POST_MAX_BYTES); (await image().png().toBuffer()).copy(padded);
    expect((await preparePostImage(new File([padded], "boundary.png", { type: "image/png" }))).success).toBe(true);
    expect(await preparePostImage(new File([Buffer.alloc(POST_MAX_BYTES + 1)], "large.png", { type: "image/png" })))
      .toMatchObject({ success: false, message: "La imagen debe pesar como máximo 5 MiB." });
  });
  it("accepts the 4096-pixel boundary and rejects oversized axes, empty files and forged MIME", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = await image(4096, 1).png().toBuffer();
    expect((await preparePostImage(new File([boundary], "wide.png", { type: "image/png" }))).success).toBe(true);
    for (const file of [
      new File([await image(4097, 1).png().toBuffer()], "wide.png", { type: "image/png" }),
      new File([await image(1, 4097).png().toBuffer()], "tall.png", { type: "image/png" }),
      new File([boundary], "fake.jpg", { type: "image/jpeg" }),
      new File([], "empty.png", { type: "image/png" }),
      new File(["invalid"], "broken.png", { type: "image/png" }),
      new File(["svg"], "image.svg", { type: "image/svg+xml" }),
    ]) expect((await preparePostImage(file)).success).toBe(false);
  });
  it("rejects animated WebP", async () => {
    const frames = await Promise.all(["#ff0000", "#0000ff"].map((background) =>
      sharp({ create: { width: 2, height: 2, channels: 3, background } }).png().toBuffer()));
    const bytes = await sharp(frames, { join: { animated: true } })
      .webp({ loop: 0, delay: [100, 100] }).toBuffer();
    expect((await sharp(bytes).metadata()).pages).toBe(2);
    expect(await preparePostImage(new File([bytes], "animated.webp", { type: "image/webp" })))
      .toMatchObject({ success: false });
  });
});
