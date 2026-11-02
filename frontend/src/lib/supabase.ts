import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** Lazy browser-only connection. Initialization sends no Supabase requests. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error(
      "إعدادات Supabase غير مكتملة. أضف VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY إلى frontend/.env.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new Error("عنوان مشروع Supabase غير صالح.");
  }
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== "/" ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new Error(
      "استخدم عنوان مشروع Supabase الأساسي عبر HTTPS دون بيانات دخول أو مسار إضافي.",
    );
  }
  // Accept only the public publishable-key format. Legacy JWT keys (including
  // service_role) and sb_secret_ keys are deliberately not supported here.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error(
      "تتطلب الواجهة مفتاح Supabase عامًا بصيغة publishable؛ لا تستخدم secret أو service_role.",
    );
  }

  client = createClient(endpoint.origin, publishableKey, {
    // Authentication is not enabled as part of this foundation-only change.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}
