/** Same-origin Vercel proxy. No Cloudflare credentials are accepted or forwarded. */
import process from "node:process";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  const fail = (status, message, code) =>
    response
      .status(status)
      .json({ error: { message, ...(code ? { code } : {}) } });
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
  const history = request.body?.history;
  if (
    history !== undefined &&
    (!Array.isArray(history) ||
      history.length > 10 ||
      history.some(
        (turn) =>
          !turn ||
          !["user", "assistant"].includes(turn.role) ||
          typeof turn.content !== "string" ||
          !turn.content.length ||
          turn.content.length > 2000,
      ))
  )
    return fail(422, "سياق المحادثة غير صالح.");
  try {
    const upstream = await globalThis.fetch(
      new globalThis.URL("/api/v1/demo/ask", backend),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          ...(history
            ? {
                history: history.map((turn) => ({
                  role: turn.role,
                  content: turn.content,
                })),
              }
            : {}),
        }),
        signal: globalThis.AbortSignal.timeout(40000),
        redirect: "error",
      },
    );
    if (!upstream.ok) {
      // Never forward upstream messages, bodies or headers; expose known safe codes only.
      const messages = {
        AI_NOT_CONFIGURED: "خدمة Llama غير مهيّأة في Backend.",
        FREE_PLAN_NOT_CONFIRMED:
          "لم يُؤكَّد إعداد خطة Workers Free في Backend.",
        AI_ACCESS_DENIED: "رُفض وصول Backend إلى خدمة الذكاء الاصطناعي.",
        AI_QUOTA_OR_RATE_LIMIT: "بلغت خدمة الذكاء الاصطناعي حد الاستخدام.",
        AI_BUDGET_REACHED:
          "بلغت الخدمة ميزانية محاولات الذكاء الاصطناعي المحددة لهذه العملية.",
        AI_HALTED:
          "أُوقفت خدمة الذكاء الاصطناعي بعد خطأ سابق؛ يلزم فحص Backend.",
        AI_BUSY: "خدمة الذكاء الاصطناعي مشغولة. حاول لاحقًا.",
        AI_SEARCH_INVALID:
          "تعذّر التحقق من نتائج البحث؛ لم تُستخدم مصادر غير موثوقة.",
        AI_EMBEDDING_INVALID: "تعذّر التحقق من متجهات البحث.",
        AI_ANSWER_INVALID:
          "تعذّر التحقق من الإجابة وأدلتها؛ لم تُعرض إجابة بديلة.",
        AI_PROVIDER_RESPONSE_INVALID:
          "تعذّر قراءة استجابة خدمة الذكاء الاصطناعي.",
        AI_CONNECTION_FAILED: "تعذّر اتصال Backend بخدمة الذكاء الاصطناعي.",
        AI_PROVIDER_ERROR: "أبلغت خدمة الذكاء الاصطناعي عن فشل الطلب.",
        DEMO_LIMIT: "بلغت النسخة التجريبية حد الطلبات. حاول لاحقًا.",
        INVALID_REQUEST: "السؤال أو سياق المحادثة غير صالح.",
      };
      const error = await upstream.json().catch(() => null);
      const code = error?.error?.code;
      if (upstream.status === 429) {
        response.setHeader("Retry-After", "60");
        return fail(
          429,
          typeof code === "string" && Object.hasOwn(messages, code)
            ? messages[code]
            : messages.DEMO_LIMIT,
          typeof code === "string" && Object.hasOwn(messages, code)
            ? code
            : "DEMO_LIMIT",
        );
      }
      if (typeof code === "string" && Object.hasOwn(messages, code)) {
        const status = [400, 401, 403, 413, 422, 502, 503, 504].includes(
          upstream.status,
        )
          ? upstream.status
          : 502;
        return fail(status, messages[code], code);
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
