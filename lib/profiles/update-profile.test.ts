import { describe, expect, it, vi } from "vitest";
import { updateProfile, type ProfileUpdateRepository } from "@/lib/profiles/update-profile";

const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
const validInput = { username: " Ada_42 ", displayName: " Ada Lovelace ", bio: " Nueva bio. " };
const normalized = { username: "ada_42", displayName: "Ada Lovelace", bio: "Nueva bio." };

function repository(overrides: Partial<ProfileUpdateRepository> = {}): ProfileUpdateRepository {
  return {
    findCurrent: vi.fn(async () => ({ data: { id, username: "previous_name" }, status: 200 })),
    update: vi.fn(async () => ({ data: { id }, status: 200 })),
    ...overrides,
  };
}

describe("own profile update", () => {
  it("normalizes allowed fields and returns the persisted old username", async () => {
    const store = repository();
    expect(await updateProfile(validInput, store)).toEqual({
      status: "updated", previousUsername: "previous_name", values: normalized,
    });
    expect(store.update).toHaveBeenCalledWith(id, normalized);
  });

  it("permits a repeated update without changing its target", async () => {
    const store = repository({
      findCurrent: vi.fn(async () => ({ data: { id, username: "ada_42" } })),
    });
    expect(await updateProfile(normalized, store)).toMatchObject({ status: "updated" });
    expect(await updateProfile(normalized, store)).toMatchObject({ status: "updated" });
    expect(store.update).toHaveBeenCalledTimes(2);
  });

  it.each([
    { ...validInput, username: "ab" },
    { ...validInput, username: "a".repeat(31) },
    { ...validInput, username: "invalid-name" },
    { ...validInput, displayName: "" },
    { ...validInput, displayName: "a".repeat(81) },
    { ...validInput, bio: "a".repeat(301) },
  ])("rejects invalid input without querying or writing", async (input) => {
    const store = repository();
    expect(await updateProfile(input, store)).toMatchObject({ status: "invalid" });
    expect(store.findCurrent).not.toHaveBeenCalled();
    expect(store.update).not.toHaveBeenCalled();
  });

  it("accepts exact upper field boundaries", async () => {
    const store = repository();
    expect(await updateProfile({
      username: "a".repeat(30), displayName: "a".repeat(80), bio: "a".repeat(300),
    }, store)).toMatchObject({ status: "updated" });
  });

  it("maps the database uniqueness authority to a controlled conflict", async () => {
    const store = repository({
      update: vi.fn(async () => ({ data: null, errorCode: "23505", status: 409 })),
    });
    expect(await updateProfile(validInput, store)).toEqual({
      status: "conflict", message: "Ese nombre de usuario ya está ocupado.",
    });
  });

  it.each([401, 403, 503])("handles lookup status %s without mutation", async (status) => {
    const log = vi.fn();
    const store = repository({
      findCurrent: vi.fn(async () => ({ data: null, errorCode: "PGRST000", status })),
    });
    expect(await updateProfile(validInput, store, log)).toMatchObject({
      status: status === 503 ? "error" : "unauthorized",
    });
    expect(store.update).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Profile update lookup failed", {
      code: "PGRST000", status,
    });
  });

  it.each([401, 403, 503])("handles write status %s without returning success", async (status) => {
    const store = repository({
      update: vi.fn(async () => ({ data: null, errorCode: "PGRST000", status })),
    });
    expect(await updateProfile(validInput, store, vi.fn())).toMatchObject({
      status: status === 503 ? "error" : "unauthorized",
    });
  });

  it.each([0, 503])("fails closed for status %s even with an empty error code and data", async (status) => {
    const store = repository({
      findCurrent: vi.fn(async () => ({
        data: { id, username: "previous_name" }, errorCode: "", status,
      })),
    });
    expect(await updateProfile(validInput, store, vi.fn())).toMatchObject({ status: "error" });
    expect(store.update).not.toHaveBeenCalled();
  });

  it.each([null, undefined, { id: "invalid", username: "Ada" }])(
    "does not mutate an absent or invalid current profile",
    async (data) => {
      const store = repository({ findCurrent: vi.fn(async () => ({ data })) });
      expect(await updateProfile(validInput, store, vi.fn())).toMatchObject({ status: "error" });
      expect(store.update).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined, { id: "invalid" }, { id: "12b387e1-81cb-462b-a279-fd777a181a7d" }])(
    "does not report success without confirmation of the own updated row",
    async (data) => {
      const store = repository({ update: vi.fn(async () => ({ data })) });
      expect(await updateProfile(validInput, store, vi.fn())).toMatchObject({ status: "error" });
    },
  );

  it.each(["findCurrent", "update"] as const)("redacts a thrown %s failure", async (method) => {
    const log = vi.fn();
    const store = repository({
      [method]: vi.fn(async () => { throw new Error("secret user@example.com previous_name"); }),
    });
    expect(await updateProfile(validInput, store, log)).toMatchObject({ status: "error" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|user@example.com|previous_name/);
  });
});
