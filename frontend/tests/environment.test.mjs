/** Real Vite config/dotenv loading in temporary directories; no network or secrets. */
import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { loadConfigFromFile } from "vite";

const originalOrigin = process.env.MASAR_LOCAL_API_ORIGIN;
const frontend = fileURLToPath(new globalThis.URL("../", import.meta.url));
let directory;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "masar-env-"));
  delete process.env.MASAR_LOCAL_API_ORIGIN;
  writeFileSync(join(directory, "package.json"), '{"type":"module"}');
  writeFileSync(
    join(directory, "vite.config.ts"),
    readFileSync(join(frontend, "vite.config.ts")),
  );
  symlinkSync(
    join(frontend, "node_modules"),
    join(directory, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
});
afterEach(() => {
  if (originalOrigin === undefined) delete process.env.MASAR_LOCAL_API_ORIGIN;
  else process.env.MASAR_LOCAL_API_ORIGIN = originalOrigin;
  rmSync(directory, { recursive: true, force: true });
});
async function origin(mode = "development") {
  const loaded = await loadConfigFromFile(
    { command: "serve", mode },
    join(directory, "vite.config.ts"),
    directory,
  );
  assert.ok(loaded);
  assert.equal(loaded.config.define, undefined); // No private environment injected into browser code.
  assert.equal(
    loaded.config.server.proxy["/api/demo/documents"].target,
    loaded.config.server.proxy["/api/demo/ask"].target,
  );
  return loaded.config.server.proxy["/api/demo/ask"].target;
}
test("Vite uses the current local default when no origin is configured", async () => {
  assert.equal(await origin(), "http://127.0.0.1:8000");
});
test("Vite loads the non-VITE local origin from frontend dotenv", async () => {
  writeFileSync(
    join(directory, ".env"),
    "MASAR_LOCAL_API_ORIGIN=http://127.0.0.1:8017\n",
  );
  assert.equal(await origin(), "http://127.0.0.1:8017");
});
test("Vite respects generic, local and mode-specific dotenv precedence", async () => {
  for (const [name, port] of [
    [".env", 8001],
    [".env.local", 8002],
    [".env.development", 8003],
    [".env.development.local", 8004],
  ]) {
    writeFileSync(
      join(directory, name),
      `MASAR_LOCAL_API_ORIGIN=http://127.0.0.1:${port}\n`,
    );
  }
  assert.equal(await origin(), "http://127.0.0.1:8004");
  assert.equal(await origin("production"), "http://127.0.0.1:8002");
});
test("A process environment origin overrides dotenv", async () => {
  writeFileSync(
    join(directory, ".env"),
    "MASAR_LOCAL_API_ORIGIN=http://127.0.0.1:8001\n",
  );
  process.env.MASAR_LOCAL_API_ORIGIN = "http://127.0.0.1:8020";
  assert.equal(await origin(), "http://127.0.0.1:8020");
});
