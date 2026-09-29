import { describe, expect, it, vi } from "vitest";
import {
  getWelcomeIdentityStatusLabel,
  resolveWelcomeIdentity,
  toWelcomeIdentity,
} from "@/lib/clerk/welcome-identity";

describe("welcome identity", () => {
  it("uses the available Clerk name and primary email", () => {
    expect(
      toWelcomeIdentity({
        firstName: "Ada",
        fullName: "Ada Lovelace",
        primaryEmailAddress: { emailAddress: "ada@example.com" },
      }),
    ).toEqual({
      displayName: "Ada",
      email: "ada@example.com",
      status: "complete",
    });
  });

  it("uses controlled fallbacks when name and email are absent", () => {
    expect(toWelcomeIdentity({ firstName: " ", fullName: null })).toEqual({
      displayName: "estudiante",
      email: "Cuenta de Clerk conectada",
      status: "incomplete",
    });
    expect(getWelcomeIdentityStatusLabel("incomplete")).toBe(
      "Identidad parcial; puedes completar tus datos en Clerk",
    );
  });

  it("keeps available identity fields when only one is absent", () => {
    expect(
      toWelcomeIdentity({
        fullName: "Grace Hopper",
        primaryEmailAddress: null,
      }),
    ).toEqual({
      displayName: "Grace Hopper",
      email: "Cuenta de Clerk conectada",
      status: "incomplete",
    });
  });

  it("returns an unavailable state and redacted log when Clerk fails", async () => {
    const logError = vi.fn();
    const identity = await resolveWelcomeIdentity(async () => {
      throw new Error("token-secret user@example.com");
    }, logError);

    expect(identity.status).toBe("unavailable");
    expect(getWelcomeIdentityStatusLabel(identity.status)).toBe(
      "Identidad temporalmente no disponible",
    );
    expect(logError).toHaveBeenCalledWith("Clerk identity lookup failed", {
      errorType: "Error",
    });
    expect(JSON.stringify(logError.mock.calls)).not.toMatch(
      /token-secret|user@example\.com/,
    );
  });
});