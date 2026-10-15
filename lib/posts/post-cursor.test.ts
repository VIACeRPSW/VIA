import { describe, expect, it } from "vitest";
import { parsePostCursor } from "./post-cursor";

describe("post pagination cursor", () => {
  const cursor = { before: "2026-10-15T12:00:00.123456+00:00", beforeId: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a" };
  it("accepts an absent cursor or a complete tuple without rounding", () => {
    expect(parsePostCursor({})).toEqual({ valid: true });
    expect(parsePostCursor(cursor)).toEqual({ valid: true, cursor });
  });
  it.each([
    { before: cursor.before }, { beforeId: cursor.beforeId }, { ...cursor, before: "bad" },
    { ...cursor, beforeId: "invalid" }, { ...cursor, before: [cursor.before, cursor.before] },
  ])("rejects malformed or repeated fields", (params) => {
    expect(parsePostCursor(params)).toEqual({ valid: false });
  });
});
