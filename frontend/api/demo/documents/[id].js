/** Read the actual packaged RAG source through the existing Backend only. */
import process from "node:process";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  const fail = (status) => response.status(status).end();
  if (request.method !== "GET") return fail(405);
  const id = request.query?.id;
  if (typeof id !== "string" || !/^[a-z0-9-]{1,100}$/.test(id))
    return fail(400);
  try {
    const backend = new globalThis.URL(process.env.MASAR_DEMO_BACKEND_URL);
    if (
      backend.protocol !== "https:" ||
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash ||
      backend.pathname !== "/" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)
    )
      return fail(503);
    const upstream = await globalThis.fetch(
      new globalThis.URL("/api/v1/demo/documents/" + id, backend),
      { redirect: "error", signal: globalThis.AbortSignal.timeout(10000) },
    );
    if (!upstream.ok) return fail(upstream.status === 404 ? 404 : 502);
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    return response.status(200).send(await upstream.text());
  } catch {
    return fail(502);
  }
}
