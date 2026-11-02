import { apiRequest } from "./api";
export interface AnswerSource {
  id: string;
  document_id: string;
  title: string;
  section: string;
  quote: string;
  excerpt: string;
}
export interface AssistantAnswer {
  status: "answered" | "not_found";
  answer: string;
  sources: AnswerSource[];
  demo: boolean;
  generated_by: string | null;
  model: string | null;
  conversation_id?: string;
  request_id?: string;
}
export interface DemoDocument {
  id: string;
  title: string;
  category: string;
  sections: { title: string; content: string }[];
}
async function requestJson(
  path: string,
  signal: AbortSignal,
  options: RequestInit = {},
) {
  let response: Response;
  try {
    response = await apiRequest(path, { ...options, signal });
  } catch {
    if (signal.aborted) throw new DOMException("أُلغي الطلب.", "AbortError");
    throw new Error(
      "تعذّر الاتصال بالخدمة الخلفية. تأكد من تشغيلها ثم أعد المحاولة.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("استجابة غير صالحة من الخدمة الخلفية.");
  }
  if (!response.ok)
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "تعذّر إتمام الطلب. حاول لاحقًا.",
    );
  return data;
}
export async function askAssistant(
  question: string,
  signal: AbortSignal,
  conversationId?: string,
  requestId: string = crypto.randomUUID(),
): Promise<AssistantAnswer> {
  const data = await requestJson("/assistant/ask", signal, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
      request_id: requestId,
    }),
  });
  if (
    !["answered", "not_found"].includes(data.status) ||
    typeof data.answer !== "string" ||
    !Array.isArray(data.sources)
  )
    throw new Error("استجابة غير متوقعة من الخدمة.");
  return data;
}
export async function getDemoDocuments(
  signal: AbortSignal,
): Promise<DemoDocument[]> {
  const data = await requestJson("/demo/documents", signal);
  if (!Array.isArray(data.documents))
    throw new Error("استجابة الوثائق غير صالحة.");
  return data.documents;
}
