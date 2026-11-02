const key = "masar-reduce-motion";
export function readReducedMotion(): boolean {
  try {
    return localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}
export function applyReducedMotion(value: boolean) {
  document.documentElement.dataset.reduceMotion = String(value);
}
export function saveReducedMotion(value: boolean): boolean {
  applyReducedMotion(value);
  try {
    localStorage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}
