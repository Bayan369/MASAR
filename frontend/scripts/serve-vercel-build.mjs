/** Local test adapter for this project's Vercel rules, not the Vercel runtime. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { log } from "node:console";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  await readFile(resolve(frontend, "vercel.json"), "utf8"),
);
if (
  config.outputDirectory !== "dist" ||
  config.rewrites?.length !== 1 ||
  config.rewrites[0].source !== "/((?!api/).*)" ||
  config.rewrites[0].destination !== "/index.html" ||
  !config.headers?.every((rule) => rule.source === "/(.*)")
) {
  throw new Error(
    "Vercel rules changed: update the local adapter before validating them.",
  );
}
const output = resolve(frontend, config.outputDirectory);
await stat(resolve(output, "index.html"));
const headers = Object.fromEntries(
  config.headers.flatMap((rule) =>
    rule.headers.map((header) => [header.key, header.value]),
  ),
);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, headers).end();
      return;
    }
    const pathname = decodeURIComponent(
      new URL(request.url, "http://127.0.0.1").pathname,
    );
    let file = resolve(output, "." + pathname);
    if (file !== output && !file.startsWith(output + sep)) {
      response.writeHead(400, headers).end();
      return;
    }
    // Existing assets are served as files; application routes fall back to the SPA.
    const exists = await stat(file)
      .then((value) => value.isFile())
      .catch(() => false);
    if (!exists && pathname.startsWith("/api/")) {
      response
        .writeHead(404, { ...headers, "Content-Type": "application/json" })
        .end('{"error":"API functions require the Vercel runtime"}');
      return;
    }
    if (!exists) file = resolve(output, "." + config.rewrites[0].destination);
    const body = await readFile(file);
    response.writeHead(200, {
      ...headers,
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500, headers).end();
  }
});
server.listen(5175, "127.0.0.1", () =>
  log("Local Vercel-rule adapter ready on port 5175"),
);
for (const event of ["SIGTERM", "SIGINT"])
  process.on(event, () => server.close(() => process.exit(0)));
