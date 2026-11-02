/** Public API location only. Credentials must never be stored in VITE_ variables. */
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");
export function apiRequest(path: string, options: RequestInit = {}) {
  return fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    signal: options.signal ?? AbortSignal.timeout(5000),
  });
}
