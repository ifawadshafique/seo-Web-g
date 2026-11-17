import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList } from "node:net";
const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, prefix, "ipv4");
export async function linkResponds(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      url.username ||
      url.password
    )
      return false;
    const results = await lookup(url.hostname, { all: true });
    if (
      !results.length ||
      results.some((result) =>
        result.family === 4
          ? blocked.check(result.address, "ipv4")
          : !/^2[0-9a-f]{3}:/i.test(result.address),
      )
    )
      return false;
    const address = results[0];
    // Pin the validated DNS result, preventing rebinding to an internal host.
    return await new Promise<boolean>((resolve) => {
      const req = request(
        url,
        {
          method: "HEAD",
          timeout: 3000,
          lookup: (_host, _options, callback) =>
            callback(null, address.address, address.family),
        },
        (response) => {
          response.resume();
          resolve(
            !!response.statusCode &&
              response.statusCode >= 200 &&
              response.statusCode < 400,
          );
        },
      );
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    });
  } catch {
    return false;
  }
}
