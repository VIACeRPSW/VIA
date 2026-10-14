import { afterEach, describe, expect, it, vi } from "vitest";
import { changeAvatar, type AvatarRepository } from "@/lib/profiles/avatar-operation";
function repository(overrides: Partial<AvatarRepository> = {}): AvatarRepository {
  return {
    plan: vi.fn(async () => ({})),
    upload: vi.fn(async () => ({})),
    abort: vi.fn(async () => ({})),
    commit: vi.fn(async () => ({ committed: true })),
    cleanup: vi.fn(async () => true),
    ...overrides,
  };
}
const upload = { path: "opaque-path", url: "public-url", buffer: Buffer.from("prepared") };
afterEach(() => vi.restoreAllMocks());
describe("avatar mutation and compensation", () => {
  it("journals before uploading and cleans only after committing", async () => {
    const store = repository();
    expect(await changeAvatar(store, "old-url", upload)).toMatchObject({
      status: "success", avatarChanged: true, cleanupPending: false,
    });
    expect(store.commit).toHaveBeenCalledWith("old-url", upload.url, upload.path);
    expect(vi.mocked(store.plan).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(store.upload).mock.invocationCallOrder[0]);
    expect(vi.mocked(store.commit).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(store.cleanup).mock.invocationCallOrder[0]);
  });
  it("retires the reference before cleaning up the previous object", async () => {
    const store = repository();
    expect(await changeAvatar(store, "old-url", null)).toMatchObject({
      status: "success", message: "Avatar retirado.",
    });
    expect(store.commit).toHaveBeenCalledWith("old-url", null, null);
    expect(store.upload).not.toHaveBeenCalled();
  });
  it.each(["plan", "upload", "commit"] as const)("does not report success after a %s failure", async (step) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = repository({
      [step]: vi.fn(async () => ({ errorCode: "TEST_FAILURE", committed: false })),
    });
    expect(await changeAvatar(store, "old-url", upload)).toMatchObject({ status: "error" });
    if (step === "plan") expect(store.upload).not.toHaveBeenCalled();
    else expect(store.abort).toHaveBeenCalledWith(upload.path);
  });
  it("compensates a concurrent reference change", async () => {
    const store = repository({ commit: vi.fn(async () => ({ committed: false })) });
    expect(await changeAvatar(store, "old-url", upload)).toMatchObject({ status: "error" });
    expect(store.abort).toHaveBeenCalledWith(upload.path);
  });
  it("reports saved-but-pending instead of hiding a cleanup failure", async () => {
    const store = repository({ cleanup: vi.fn(async () => false) });
    expect(await changeAvatar(store, "old-url", upload)).toMatchObject({
      status: "warning", avatarChanged: true, cleanupPending: true,
    });
  });
  it("keeps recovery observable when both uploading and scheduling fail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = repository({
      upload: vi.fn(async () => { throw new Error("private-token"); }),
      abort: vi.fn(async () => ({ errorCode: "DATABASE_UNAVAILABLE" })),
      cleanup: vi.fn(async () => false),
    });
    expect(await changeAvatar(store, null, upload)).toMatchObject({ status: "error", cleanupPending: true });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-token");
  });
  it("preserves the saved reference if cleanup throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = repository({ cleanup: vi.fn(async () => { throw new Error("private-url"); }) });
    expect(await changeAvatar(store, null, upload)).toMatchObject({
      status: "warning", avatarChanged: true, cleanupPending: true,
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-url");
  });
});
