import type { Context, Reply } from "./knowledge";

export const liveDemo = import.meta.env.VITE_ASSISTANT_MODE === "llama";

export async function askLlama(
  question: string,
  context: Context,
): Promise<Reply> {
  let response: Response;
  try {
    response = await fetch("/api/demo/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
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
    !["answered", "not_found"].includes(data.status) ||
    typeof data.answer !== "string" ||
    !Array.isArray(data.sources) ||
    (data.status === "answered" &&
      (data.generated_by !== "Cloudflare Workers AI / Llama" || !data.model))
  )
    throw new Error("تعذّر التحقق من مصدر إجابة Llama.");
  return {
    text: data.answer,
    status: data.status === "answered" ? "verified" : "unavailable",
    sources: data.sources.map((source: { title: string; quote: string }) => ({
      title: source.title,
      quote: source.quote,
    })),
    context,
  };
}
