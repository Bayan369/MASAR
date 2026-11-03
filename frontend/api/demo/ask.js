/** Same-origin Vercel proxy. No Cloudflare credentials are accepted or forwarded. */
import process from "node:process";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  const fail = (status, message) =>
    response.status(status).json({ error: { message } });
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return fail(405, "الطريقة غير مسموحة.");
  }
  let backend;
  try {
    backend = new globalThis.URL(process.env.MASAR_DEMO_BACKEND_URL);
    if (
      backend.protocol !== "https:" ||
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash ||
      backend.pathname !== "/" ||
      ["localhost", "127.0.0.1", "[::1]"].includes(backend.hostname)
    )
      throw new Error();
  } catch {
    return fail(503, "خدمة Llama غير مهيّأة في النسخة التجريبية.");
  }
  const question = request.body?.question;
  if (
    typeof question !== "string" ||
    question.trim().length < 3 ||
    question.length > 2000
  )
    return fail(422, "اكتب سؤالًا بين 3 و2000 حرف.");
  try {
    const upstream = await globalThis.fetch(
      new globalThis.URL("/api/v1/demo/ask", backend),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
        signal: globalThis.AbortSignal.timeout(40000),
        redirect: "error",
      },
    );
    if (!upstream.ok) {
      if (upstream.status === 429) {
        response.setHeader("Retry-After", "60");
        return fail(429, "بلغت النسخة التجريبية حد الطلبات. حاول لاحقًا.");
      }
      return fail(
        502,
        "تعذّر الحصول على إجابة من Llama. حاول لاحقًا؛ لم تُستخدم إجابة بديلة.",
      );
    }
    const data = await upstream.json();
    return response.status(200).json(data);
  } catch {
    return fail(
      502,
      "تعذّر الاتصال بخدمة Llama. حاول لاحقًا؛ لم تُستخدم إجابة بديلة.",
    );
  }
}
