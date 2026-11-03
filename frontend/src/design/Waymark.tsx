/** MASAR's directional mark: a continuous route, with a clear next step. */
export function Waymark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 76V51C18 42 25 35 34 35H62C71 35 78 28 78 19V14"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M65 22L78 9L91 22"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="79" r="7" fill="currentColor" />
      <circle
        cx="49"
        cy="35"
        r="6"
        fill="var(--route-signal)"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
