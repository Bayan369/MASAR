/** Original gateway composition; never represents a completed AI request. */
export function KnowledgeGateway({ stage }: { stage: number }) {
  return (
    <div className="knowledge-gateway" aria-hidden="true">
      <svg viewBox="0 0 680 600" fill="none">
        <defs>
          <linearGradient
            id="gateway-depth"
            x1="190"
            y1="60"
            x2="475"
            y2="520"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#c6e7fa" />
            <stop offset="1" stopColor="#e9f5fd" />
          </linearGradient>
        </defs>
        <path className="gateway-ground" d="M45 510 335 340 640 510 350 678Z" />
        <path
          className="gateway-depth"
          d="M218 472V148L425 42 472 69V364L426 390V120L264 202V445Z"
        />
        <path
          className="gateway-face"
          d="M218 472V148L425 42V390L382 414V119L263 181V446Z"
        />
        <path
          className="gateway-outline"
          d="M218 472V148L425 42 472 69V364M425 42V390M263 446V181L382 119V414"
        />
        <path
          className="gateway-route-base"
          d="M54 300 180 228Q195 219 213 228L300 277Q318 287 336 277L598 126"
        />
        <path
          key={stage}
          className="gateway-route-light"
          d="M54 300 180 228Q195 219 213 228L300 277Q318 287 336 277L598 126"
        />
        <g className="gateway-document">
          <path d="m90 245 84-48v103l-84 48Z" />
          <path d="m107 256 45-26m-45 46 45-26m-45 46 28-16" />
        </g>
        <g className="gateway-response">
          <path d="m487 138 110-62v98l-72 42-23 36v-23l-15 8Z" />
          <path d="m506 151 70-40m-70 62 50-28" />
        </g>
        <path
          className="gateway-coordinate"
          d="M50 510H630M335 520V553M335 25V0"
        />
      </svg>
      <span className="gateway-label gateway-label-source">
        من معرفة الشركة
      </span>
      <span className="gateway-label gateway-label-answer">إلى وضوح خطوتك</span>
    </div>
  );
}
