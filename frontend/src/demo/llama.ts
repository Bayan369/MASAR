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
      signal: AbortSignal.timeout(45000),
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
  if (!response.ok)
    throw new Error(data?.error?.message || "تعذّر الحصول على إجابة من Llama.");
  if (
    !["answered", "not_found", "conversational"].includes(data.status) ||
    typeof data.answer !== "string" ||
    !Array.isArray(data.sources) ||
    data.sources.some(
      (source: { title?: unknown; quote?: unknown } | null) =>
        !source ||
        typeof source.title !== "string" ||
        typeof source.quote !== "string",
    ) ||
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
        : data.status === "conversational"
          ? "conversational"
          : "unavailable",
    sources: data.sources.map((source: Reply["sources"][number]) => ({
      ...source,
    })),
    context,
  };
}
