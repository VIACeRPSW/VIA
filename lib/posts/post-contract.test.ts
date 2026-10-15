import { describe, expect, it } from "vitest";
import { canonicalHashtagsSchema, normalizeHashtags, postInputSchema } from "./post-contract";

const input = {
  operationId: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228a",
  categoryId: "b02e9ce0-0a90-4e7c-a5cb-f54ff20f228b",
  title: "Post", description: "", hashtags: "#ciencia",
};
describe("post contract", () => {
  it("normalizes and deduplicates Unicode tags before enforcing the count", () => {
    expect(normalizeHashtags(" #CIENCIA, ciencia #NIN\u0303OS, #niños ")).toEqual(["ciencia", "niños"]);
    expect(postInputSchema.parse({ ...input, title: "\uFEFF Hola \n" })).toMatchObject({
      title: "Hola", description: "", hashtags: ["ciencia"],
    });
  });
  it.each(["", "#a", "#tag!", "##tag", "aa bb cc dd ee ff", "x".repeat(31)])("rejects invalid tags %s", (hashtags) => {
    expect(postInputSchema.safeParse({ ...input, hashtags }).success).toBe(false);
  });
  it("enforces canonical unique tags and Unicode character boundaries", () => {
    expect(canonicalHashtagsSchema.safeParse(["aa", "中文", "niños", "árbol", "x".repeat(30)]).success).toBe(true);
    for (const tags of [["AA"], ["aa", "aa"], ["a\u0301rbol"], ["a"], []]) {
      expect(canonicalHashtagsSchema.safeParse(tags).success).toBe(false);
    }
    expect(postInputSchema.safeParse({ ...input, title: "😀".repeat(120), description: "😀".repeat(2000) }).success).toBe(true);
    for (const change of [
      { title: "😀".repeat(121) }, { title: " \n" }, { description: "😀".repeat(2001) },
      { operationId: "invalid" }, { categoryId: "" }, { hashtags: " ".repeat(1001) },
    ]) expect(postInputSchema.safeParse({ ...input, ...change }).success).toBe(false);
  });
});
