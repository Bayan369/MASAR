/** Public origin only. Cloudflare credentials never belong in browser configuration. */
export function demoApiUrl(
  path: string,
  configuredOrigin = import.meta.env.VITE_API_BASE_URL || "",
): string {
  if (!/^\/(?:ask|documents(?:\/[a-z0-9-]+)?)$/.test(path))
    throw new Error("مسار خدمة المساعد غير صالح.");
  const value = configuredOrigin.trim();
  // Retain existing local Vite / Vercel proxy behavior when no origin is set.
  if (!value) return "/api/demo" + path;
  let origin: URL;
  try {
    origin = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
    const localBuild = import.meta.env.DEV || import.meta.env.MODE === "test";
    if (
      origin.username ||
      origin.password ||
      origin.search ||
      origin.hash ||
      origin.pathname !== "/" ||
      (origin.protocol !== "https:" &&
        !(localBuild && local && origin.protocol === "http:"))
    )
      throw new Error();
  } catch {
    throw new Error("عنوان خدمة المساعد غير صالح. راجع إعداد الواجهة.");
  }
  return origin.origin + "/api/v1/demo" + path;
}

/** Only the backend's established, bounded source-reference format is accepted. */
export function demoSourceHref(
  url: string | null | undefined,
): string | undefined {
  if (!url || !/^\/api\/demo\/documents\/[a-z0-9-]+$/.test(url))
    return undefined;
  return demoApiUrl(url.slice("/api/demo".length));
}
