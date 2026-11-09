import type { Context, Reply } from "./knowledge";

export const liveDemo = import.meta.env.VITE_ASSISTANT_MODE !== "offline";

export type HistoryTurn = { role: "user" | "assistant"; content: string };

export async function askLlama(
  question: string,
  context: Context,
  history: HistoryTurn[] = [],
): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch("/api/demo/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        ...(history.length
          ? {
              history: history.slice(-10).map((turn) => ({
                role: turn.role,
                content: turn.content.slice(0, 2000),
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error(
      "تعذّر الاتصال بخدمة Llama. حاول لاحقًا؛ لم تُستخدم إجابة بديلة.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("استجابة غير صالحة من خدمة Llama.");
  }
  if (!response.ok) {
    const code = data?.error?.code;
    const message =
      response.status === 429
        ? "خدمة المساعد مشغولة أو وصلت إلى حد الطلبات. انتظر قليلًا ثم حاول مجددًا."
        : code === "AI_SEARCH_INVALID" ||
            code === "AI_SEARCH_INCOMPLETE" ||
            code === "AI_ANSWER_INVALID" ||
            code === "AI_GENERAL_INVALID"
          ? "تعذّر التحقق من إجابة المساعد ومصادرها. حاول لاحقًا؛ لم تُعرض إجابة غير موثقة."
          : "تعذّر الحصول على إجابة من Llama الآن. حاول لاحقًا؛ لم تُستخدم إجابة بديلة.";
    throw new Error(message);
  }
  if (
    !["answered", "not_found", "conversational", "general"].includes(
      data.status,
    ) ||
    typeof data.answer !== "string" ||
    !Array.isArray(data.sources) ||
    data.sources.some(
      (source: { title?: unknown; quote?: unknown } | null) =>
        !source ||
        typeof source.title !== "string" ||
        typeof source.quote !== "string",
    ) ||
    (data.status === "general" &&
      (data.sources.length !== 0 ||
        data.generated_by !== "Cloudflare Workers AI / Llama" ||
        !data.model)) ||
    (data.status === "answered" &&
      (!data.sources.length ||
        data.generated_by !== "Cloudflare Workers AI / Llama" ||
        !data.model))
  )
    throw new Error("تعذّر التحقق من مصدر إجابة Llama.");
  return {
    text: data.answer,
    status:
      data.status === "answered"
        ? "verified"
        : data.status === "general"
          ? "general"
          : data.status === "conversational"
            ? "conversational"
            : "unavailable",
    sources: data.sources.map((source: Reply["sources"][number]) => ({
      ...source,
    })),
    context,
  };
}
