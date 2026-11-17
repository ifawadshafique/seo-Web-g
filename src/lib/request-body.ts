import { ContentError } from "./api-error";
export async function boundedJson(
  request: Request,
  limit = 20000,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ContentError("Missing request body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new ContentError("Request is too large", 413);
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
