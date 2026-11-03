import { useEffect, type RefObject } from "react";

/** One observer per page; content is readable even before observation or without motion. */
export function usePageMotion(
  rootRef: RefObject<HTMLElement | null>,
  route: string,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const targets = root.querySelectorAll<HTMLElement>(
      ".platform-page-heading, .platform-hero, .platform-start-card, .platform-link-card, .platform-company, .platform-department-card, .platform-detail-hero, .platform-procedure-row, .platform-steps > li, .platform-reading section, .platform-source-panel",
    );
    let observer: IntersectionObserver | undefined;
    function configure() {
      observer?.disconnect();
      const reduced =
        preference.matches ||
        document.documentElement.dataset.reduceMotion === "true";
      root!.dataset.motion = reduced ? "reduced" : "enabled";
      targets.forEach((target) => delete target.dataset.reveal);
      if (reduced || !("IntersectionObserver" in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).dataset.reveal = "visible";
              observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.08 },
      );
      targets.forEach((target) => observer!.observe(target));
    }
    configure();
    preference.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", configure);
      targets.forEach((target) => delete target.dataset.reveal);
      delete root.dataset.motion;
    };
  }, [rootRef, route]);
}
