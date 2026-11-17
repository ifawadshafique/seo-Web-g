import { expect, it } from "vitest";
import { boundedJson } from "./request-body";
it("bounds public form bodies even without Content-Length", async () => {
  const request = new Request("http://localhost/api/contact", {
    method: "POST",
    body: JSON.stringify({ message: "x".repeat(100) }),
  });
  await expect(boundedJson(request, 20)).rejects.toMatchObject({ status: 413 });
});
it("parses valid JSON and rejects malformed JSON", async () => {
  await expect(
    boundedJson(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: '{"message":"Hello"}',
      }),
    ),
  ).resolves.toEqual({ message: "Hello" });
  await expect(
    boundedJson(
      new Request("http://localhost/api/contact", {
        method: "POST",
        body: "{",
      }),
    ),
  ).rejects.toThrow(SyntaxError);
});
