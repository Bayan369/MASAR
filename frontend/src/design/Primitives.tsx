import type { ReactNode, Ref } from "react";
import { Search, X } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  headingRef,
  children,
}: {
  title: string;
  eyebrow: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children?: ReactNode;
}) {
  return (
    <div className="platform-page-heading">
      <div>
        <span className="platform-eyebrow">{eyebrow}</span>
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="platform-search">
      <Search size={18} aria-hidden="true" />
      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        dir="auto"
      />
      {value && (
        <button
          className="platform-icon-button"
          aria-label="مسح البحث"
          onClick={() => onChange("")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
export function EmptySearch({ onClear }: { onClear: () => void }) {
  return (
    <section className="platform-empty" role="status">
      <span className="platform-empty-icon">
        <Search size={27} />
      </span>
      <h2>لم نجد نتائج مطابقة</h2>
      <p>جرّب اسمًا أو كلمة أخرى، أو اعرض القائمة كاملة.</p>
      <button className="platform-button secondary" onClick={onClear}>
        مسح البحث
      </button>
    </section>
  );
}
