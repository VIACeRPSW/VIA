import { describe, expect, it, vi } from "vitest";
import {
  createProfile,
  type ProfileRepository,
} from "@/lib/profiles/create-profile";

const validInput = {
  username: "Ada_42",
  displayName: "Ada Lovelace",
  bio: "Matemáticas e imaginación.",
};

function createRepository(
  overrides: Partial<ProfileRepository> = {},
): ProfileRepository {
  return {
    findCurrent: vi.fn(async () => ({ data: null })),
    insert: vi.fn(async () => ({})),
    ...overrides,
  };
}

describe("create profile", () => {
  it("creates a normalized profile", async () => {
    const repository = createRepository();

    await expect(createProfile(validInput, repository)).resolves.toEqual({
      status: "created",
    });
    expect(repository.insert).toHaveBeenCalledWith({
      username: "ada_42",
      displayName: "Ada Lovelace",
      bio: "Matemáticas e imaginación.",
    });
  });

  it("is idempotent when the current profile already exists", async () => {
    const repository = createRepository({
      findCurrent: vi.fn(async () => ({ data: { id: "profile-id" } })),
    });

    await expect(createProfile(validInput, repository)).resolves.toEqual({
      status: "existing",
    });
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("returns field errors without querying for invalid input", async () => {
    const repository = createRepository();
    const result = await createProfile(
      { ...validInput, username: "invalid-name" },
      repository,
    );

    expect(result.status).toBe("invalid");
    expect(repository.findCurrent).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("maps a unique constraint race to a controlled conflict", async () => {
    const repository = createRepository({
      insert: vi.fn(async () => ({ errorCode: "23505", status: 409 })),
    });

    await expect(createProfile(validInput, repository)).resolves.toEqual({
      status: "conflict",
      message: "Ese nombre de usuario ya está ocupado.",
    });
  });

  it("redacts repository failures", async () => {
    const logError = vi.fn();
    const repository = createRepository({
      findCurrent: vi.fn(async () => {
        throw new Error("database-secret user@example.com");
      }),
    });

    await expect(
      createProfile(validInput, repository, logError),
    ).resolves.toEqual({
      status: "error",
      message: "No pudimos comprobar tu perfil. Inténtalo de nuevo.",
    });
    expect(logError).toHaveBeenCalledWith("Profile lookup could not start", {
      errorType: "Error",
    });
    expect(JSON.stringify(logError.mock.calls)).not.toMatch(
      /database-secret|user@example\.com/,
    );
  });
});