import { describe, expect, it } from "vitest";
import { commentContentSchema, commentInputSchema } from "./comment-contract";
const id = "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a";
describe("comment contract", () => {
  it.each([1, 999, 1000])("accepts %i Unicode code points without counting UTF-16 units", (length) => {
    const text = "\u{1F600}".repeat(length);
    expect(commentContentSchema.parse(` \uFEFF${text}\u00A0 `)).toBe(text);
  });
  it.each(["", " \t\n\u00A0\uFEFF", "a".repeat(1001), "\u{1F600}".repeat(1001), "a\0b", "\uD800"])(
    "rejects empty, oversized or nonrepresentable text", (content) => {
      expect(commentContentSchema.safeParse(content).success).toBe(false);
    },
  );
  it("preserves plain text, inner whitespace, HTML-like content and normalization", () => {
    const text = '<script>alert("inert")</script>\n  e\u0301';
    expect(commentContentSchema.parse(` ${text} `)).toBe(text);
  });
  it("accepts only the post, content and operation ID", () => {
    const input = { postId: id, operationId: id, content: " Texto " };
    expect(commentInputSchema.parse(input)).toEqual({ ...input, content: "Texto" });
    expect(commentInputSchema.safeParse({ ...input, user_id: id }).success).toBe(false);
    expect(commentInputSchema.safeParse({ ...input, operationId: "invalid" }).success).toBe(false);
  });
});
