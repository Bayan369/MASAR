/** One original vector asset for the product signature, navigation and favicon. */
export function GatewayMark({ className = "" }: { className?: string }) {
  return (
    <img
      className={`gateway-mark ${className}`}
      src="/masar-gateway.svg"
      width={64}
      height={64}
      alt=""
      aria-hidden="true"
    />
  );
}
