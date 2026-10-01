import { describe, expect, it } from "vitest";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  validateProfileInput,
} from "@/lib/profiles/profile-contract";

describe("profile contract", () => {
  it("normalizes a valid profile", () => {
    expect(
      validateProfileInput({
        username: "  Ada_42 ",
        displayName: "  Ada Lovelace  ",
        bio: "  Matemáticas e imaginación.  ",
      }),
    ).toEqual({
      success: true,
      data: {
        username: "ada_42",
        displayName: "Ada Lovelace",
        bio: "Matemáticas e imaginación.",
      },
    });
  });

  it.each(["", "ab", "a-b", "áda", "a".repeat(31)])(
    "rejects invalid username %j",
    (username) => {
      const result = validateProfileInput({
        username,
        displayName: "Ada",
        bio: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.fieldErrors.username).toBeDefined();
      }
    },
  );

  it("accepts Unicode in visible text", () => {
    const result = validateProfileInput({
      username: "estudiante_1",
      displayName: "Ángela Núñez",
      bio: "Aprendo física y programación.",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing or oversized visible fields", () => {
    const result = validateProfileInput({
      username: "estudiante_1",
      displayName: " ".repeat(DISPLAY_NAME_MAX_LENGTH + 1),
      bio: "a".repeat(BIO_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors.displayName).toBeDefined();
      expect(result.fieldErrors.bio).toBeDefined();
    }
  });
});