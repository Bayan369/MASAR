import { getSupabaseClient } from "./supabase";
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
export async function apiRequest(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    if (data.session)
      headers.set("Authorization", "Bearer " + data.session.access_token);
  } catch {
    /* Unconfigured clients get a safe backend/configuration error. */
  }
  const response = await fetch(baseUrl + "/api/v1" + path, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(30000),
  });
  if (response.status === 401)
    window.dispatchEvent(new Event("masar-session-expired"));
  return response;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await apiRequest(path, options);
  } catch {
    throw new Error("تعذّر الاتصال بالخدمة. تحقق من الشبكة ثم حاول مجددًا.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("استجابة غير صالحة من الخدمة.");
  }
  if (!response.ok)
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "تعذّر تنفيذ العملية.",
    );
  return data;
}
export function jsonBody(data: unknown, method = "POST"): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
