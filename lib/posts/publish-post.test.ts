import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishPost, type PostRepository } from "./publish-post";

const input = { operationId: "operation", categoryId: "category", title: "Title", description: "", hashtags: ["tag"] };
function repository() {
  return {
    begin: vi.fn<PostRepository["begin"]>().mockResolvedValue({ status: "ready", image_path: "own/image.webp" }),
    upload: vi.fn().mockResolvedValue(undefined), commit: vi.fn().mockResolvedValue("post"),
    abort: vi.fn().mockResolvedValue(undefined), cleanup: vi.fn().mockResolvedValue(true),
  };
}
const publish = (repo: PostRepository) => publishPost(input, Buffer.from("image"), "digest", "lease", repo);
beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());
describe("post publication", () => {
  it("uploads before committing and never cleans a published image", async () => {
    const repo = repository();
    expect(await publish(repo)).toEqual({ status: "success", postId: "post" });
    expect(repo.upload).toHaveBeenCalledWith("own/image.webp", Buffer.from("image"));
    expect(repo.commit).toHaveBeenCalledWith("operation", "lease");
    expect(repo.upload.mock.invocationCallOrder[0]).toBeLessThan(repo.commit.mock.invocationCallOrder[0]);
    expect(repo.cleanup).not.toHaveBeenCalled();
  });
  it("returns the same post without uploading again", async () => {
    const repo = repository(); repo.begin.mockResolvedValue({ status: "published", post_id: "saved" });
    expect(await publish(repo)).toEqual({ status: "success", postId: "saved" });
    expect(repo.upload).not.toHaveBeenCalled();
    expect(repo.commit).not.toHaveBeenCalled();
  });
  it.each(["busy", "conflict", "cleanup"] as const)("does not overwrite an operation in state %s", async (status) => {
    const repo = repository(); repo.begin.mockResolvedValue({ status });
    expect(await publish(repo)).toMatchObject({ status: status === "cleanup" ? "error" : status });
    expect(repo.upload).not.toHaveBeenCalled();
    expect(repo.abort).not.toHaveBeenCalled();
  });
  it("recovers a lost commit response without deleting the published image", async () => {
    const repo = repository(); repo.commit.mockRejectedValue(new Error("private-token"));
    repo.begin.mockResolvedValueOnce({ status: "ready", image_path: "own/image.webp" })
      .mockResolvedValueOnce({ status: "published", post_id: "saved" });
    expect(await publish(repo)).toEqual({ status: "success", postId: "saved" });
    expect(repo.cleanup).not.toHaveBeenCalled();
    expect(repo.abort).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it.each(["upload", "commit"] as const)("compensates %s failure using the same operation and lease", async (step) => {
    const repo = repository(); repo[step].mockRejectedValue(new Error("unavailable"));
    expect(await publish(repo)).toMatchObject({ status: "error", cleanupPending: false });
    expect(repo.abort).toHaveBeenCalledWith("operation", "lease");
    expect(repo.cleanup).toHaveBeenCalledOnce();
    if (step === "upload") expect(repo.commit).not.toHaveBeenCalled();
  });
  it("reports pending cleanup if recovery and cleanup fail", async () => {
    const repo = repository();
    repo.begin.mockRejectedValue(new Error("unavailable")); repo.cleanup.mockRejectedValue(new Error("private-token"));
    expect(await publish(repo)).toMatchObject({ status: "error", cleanupPending: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
});
