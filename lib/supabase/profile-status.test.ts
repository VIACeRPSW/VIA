import { describe, expect, it } from "vitest";
import { SupabaseConfigurationError } from "@/lib/supabase/errors";
import {
  classifyProfileQuery,
  classifyProfileQueryFailure,
  getProfileDataStatusLabel,
  getSafeCaughtErrorContext,
  getSafeQueryErrorContext,
} from "@/lib/supabase/profile-status";

describe("profile data status", () => {
  it("distinguishes an available connection with and without a profile", () => {
    expect(
      classifyProfileQuery({ data: null, error: null, status: 200 }),
    ).toBe("ready");
    expect(
      classifyProfileQuery({
        data: { id: "profile-id" },
        error: null,
        status: 200,
      }),
    ).toBe("profile-found");
  });

  it("distinguishes authorization and temporary query failures", () => {
    expect(
      classifyProfileQuery({
        data: null,
        error: { code: "PGRST301" },
        status: 401,
      }),
    ).toBe("unauthorized");
    expect(
      classifyProfileQuery({
        data: null,
        error: { code: "PGRST000" },
        status: 503,
      }),
    ).toBe("temporarily-unavailable");
  });

  it("distinguishes invalid configuration from runtime failures", () => {
    expect(
      classifyProfileQueryFailure(new SupabaseConfigurationError("secret")),
    ).toBe("configuration-invalid");
    expect(classifyProfileQueryFailure(new Error("secret"))).toBe(
      "temporarily-unavailable",
    );
  });

  it("provides controlled accessible labels", () => {
    expect(getProfileDataStatusLabel("configuration-invalid")).toBe(
      "Integración de datos pendiente",
    );
    expect(getProfileDataStatusLabel("temporarily-unavailable")).toBe(
      "Datos temporalmente no disponibles",
    );
  });

  it("redacts messages and response details from log context", () => {
    const resultWithSensitiveDetails = {
      data: null,
      error: { code: "PGRST301", message: "token-secret" },
      status: 401,
      statusText: "user@example.com",
    };
    const queryContext = getSafeQueryErrorContext(resultWithSensitiveDetails);
    const caughtContext = getSafeCaughtErrorContext(
      new Error("token-secret user@example.com"),
    );

    expect(queryContext).toEqual({ code: "PGRST301", status: 401 });
    expect(caughtContext).toEqual({ errorType: "Error" });
    expect(JSON.stringify([queryContext, caughtContext])).not.toMatch(
      /token-secret|user@example\.com/,
    );
  });
});