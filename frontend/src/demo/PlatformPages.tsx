import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpLeft,
  Building2,
  BookOpen,
  Compass,
  FileText,
  Sparkles,
  ChevronLeft,
  ArrowRight,
  Mail,
  Layers,
  Route as RouteIcon,
  Check,
  CornerDownLeft,
} from "lucide-react";
import { departments } from "./catalog";
import { knowledge } from "./knowledge";
import { EmptySearch, SearchField } from "../design/Primitives";
import { Icon } from "../components/ui";
const clean = (s: string) =>
  s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/[ً-ٟ]/g, "");
export function Missing() {
  return (
    <section className="platform-empty">
      <span className="platform-empty-icon">
        <Compass size={36} />
      </span>
      <span className="platform-eyebrow">404</span>
      <h2>هذه الصفحة غير موجودة</h2>
      <p>قد يكون الرابط غير صحيح. يمكنك العودة إلى الرئيسية ومتابعة رحلتك.</p>
      <Link className="platform-button" to="/">
        العودة إلى الرئيسية
        <ArrowUpLeft size={16} />
      </Link>
    </section>
  );
}
function SourceLink({ id }: { id: string }) {
  const doc = knowledge.find((d) => d.id === id);
  return doc ? (
    <Link className="platform-source-panel" to={`/documents/${doc.id}`}>
      <span className="platform-file-icon">
        <FileText size={20} />
      </span>
      <span>
        <small>مرجع المعلومات</small>
        <strong>{doc.title}</strong>
      </span>
      <span className="platform-source-action">
        قراءة المصدر
        <ArrowUpLeft size={17} />
      </span>
    </Link>
  ) : null;
}
export function Home() {
  const start = knowledge.find((d) => d.id === "onboarding")!;
  return (
    <>
      <div className="platform-home-grid">
        <section className="platform-hero">
          <span className="platform-eyebrow">أهلًا بك في مسار</span>
          <h2>
            بداية واضحة.
            <br />
            ورحلة تعرف طريقها.
          </h2>
          <p>
            تعرّف على شركتك، اكتشف من يساعدك، واعثر على إجابات لأسئلتك. كل ما
            تحتاجه لبدايتك، في مكان واحد.
          </p>
          <div className="platform-actions">
            <Link className="platform-button" to="/onboarding">
              ابدأ رحلتك
              <ArrowUpLeft size={18} />
            </Link>
            <Link className="platform-text-link" to="/assistant">
              <Sparkles size={17} />
              تحدث مع مسار
            </Link>
          </div>
          <div className="platform-hero-signature">
            <Compass size={21} />
            <span>معرفة ترشدك، في كل خطوة.</span>
          </div>
        </section>
        <section className="platform-start-card">
          <div className="platform-section-kicker">
            <RouteIcon size={18} />
            <span>دليلك لليوم الأول</span>
          </div>
          <h2>من أين تبدأ؟</h2>
          <ol>
            {["تعرّف على فريقك", "جهّز أدوات عملك", "افهم دورك مع الفريق"].map(
              (s, i) => (
                <li key={s}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{s}</strong>
                    <small>
                      {
                        [
                          "الموارد البشرية (HR)",
                          "تقنية المعلومات (IT)",
                          "مديرك المباشر",
                        ][i]
                      }
                    </small>
                  </div>
                </li>
              ),
            )}
          </ol>
          <Link to="/onboarding" className="platform-text-link">
            استعرض دليل البداية
            <ArrowUpLeft size={16} />
          </Link>
          <span className="sr-only">{start.title}</span>
        </section>
      </div>
      <div className="platform-section-heading">
        <div>
          <span className="platform-eyebrow">وجهتك التالية</span>
          <h2>كيف يمكن لمسار مساعدتك؟</h2>
        </div>
        <span className="platform-section-note">اختر ما تحتاجه الآن</span>
      </div>
      <div className="platform-grid three">
        {[
          {
            path: "departments",
            title: "اعرف القسم المناسب",
            text: "مسؤوليات الفرق وخدماتها وطرق التواصل معها.",
            icon: Building2,
            action: "دليل الأقسام",
          },
          {
            path: "policies",
            title: "خطواتك، بكل وضوح",
            text: "الإجازات والدعم والوصول التقني؛ إجراء بخطوات واضحة.",
            icon: BookOpen,
            action: "السياسات والإجراءات",
          },
          {
            path: "assistant",
            title: "سؤال يبدأ به حوار",
            text: "اسأل، استوضح، وتابع من حيث وصلت مع اسأل مسار.",
            icon: Sparkles,
            action: "اسأل مسار (MASAR AI)",
          },
        ].map((c) => (
          <Link
            className="platform-card platform-link-card"
            key={c.path}
            to={`/${c.path}`}
          >
            <span className="platform-card-icon">
              <c.icon size={23} />
            </span>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <span className="platform-card-action">
              {c.action}
              <ArrowUpLeft size={17} />
            </span>
          </Link>
        ))}
      </div>
      <section className="platform-company">
        <div>
          <span className="platform-eyebrow">تعرف على شركتك</span>
          <h2>شركة مسار</h2>
          <p>تعرّف على أدوار الأقسام وكيف تتكامل خدماتها لمساعدتك في العمل.</p>
          <div className="platform-department-chips">
            {departments.map((d) => (
              <Link key={d.id} to={`/departments/${d.id}`}>
                {d.name}
                <bdi>({d.term})</bdi>
              </Link>
            ))}
          </div>
        </div>
        <div className="platform-company-links">
          <Link to="/departments">
            استعرض دليل الأقسام
            <ArrowUpLeft size={17} />
          </Link>
          <Link to="/documents/company">
            اقرأ التعريف بالشركة
            <ArrowUpLeft size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}
export function DepartmentsPage() {
  const [query, setQuery] = useState("");
  const filtered = departments.filter((d) =>
    clean(`${d.name} ${d.term} ${d.about} ${d.services.join(" ")}`).includes(
      clean(query.trim()),
    ),
  );
  return (
    <>
      <p className="platform-intro">
        اعرف دور كل فريق والخدمات التي يقدمها، لتصل إلى الشخص المناسب من أول
        خطوة.
      </p>
      <div className="platform-list-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label="البحث في الأقسام"
          placeholder="ابحث عن قسم أو خدمة…"
        />
        <span className="platform-result-count" aria-live="polite">
          {filtered.length} من {departments.length} أقسام
        </span>
      </div>
      {!filtered.length ? (
        <EmptySearch onClear={() => setQuery("")} />
      ) : (
        <div className="platform-grid department-grid">
          {filtered.map((d) => (
            <Link
              key={d.id}
              className="platform-card platform-department-card"
              to={`/departments/${d.id}`}
            >
              <div className="platform-department-card-top">
                <span className="platform-monogram">
                  <Icon
                    name={d.id === "administration" ? "admin" : d.id}
                    size={21}
                  />
                </span>
                <span className="platform-department-term" dir="ltr">
                  {d.term}
                </span>
                <span className="platform-card-arrow">
                  <ArrowUpLeft size={17} />
                </span>
              </div>
              <h2>{d.name}</h2>
              <p>{d.about}</p>
              <div className="platform-card-services">
                {d.services.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <span className="platform-card-action">
                تعرّف على القسم
                <ChevronLeft size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function DepartmentDetail() {
  const { id } = useParams();
  const d = departments.find((x) => x.id === id);
  if (!d) return <Missing />;
  return (
    <>
      <Link className="platform-back" to="/departments">
        <ArrowRight size={15} />
        دليل الأقسام
      </Link>
      <section className="platform-detail-hero">
        <div>
          <span className="platform-eyebrow" dir="ltr">
            {d.term}
          </span>
          <h2>
            {d.name} <bdi>({d.term})</bdi>
          </h2>
          <p>{d.about}</p>
        </div>
        <span className="platform-detail-symbol">
          <Building2 size={40} strokeWidth={1.2} />
        </span>
      </section>
      <div className="platform-detail-layout">
        <div className="platform-detail-sections">
          <section className="platform-card">
            <span className="platform-section-kicker">
              <Layers size={18} />
              الدور والمسؤوليات
            </span>
            <h3>ما الذي يتولاه هذا القسم؟</h3>
            <ul className="platform-check-list">
              {d.responsibilities.map((s) => (
                <li key={s}>
                  <Check size={16} />
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <section className="platform-card">
            <span className="platform-section-kicker">
              <CornerDownLeft size={18} />
              الخدمات
            </span>
            <h3>كيف يمكنه مساعدتك؟</h3>
            <div className="platform-service-list">
              {d.services.map((s) => (
                <div key={s}>
                  <span className="platform-service-dot" />
                  {s}
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="platform-contact-card">
          <span className="platform-card-icon">
            <Mail size={23} />
          </span>
          <h3>متى تتواصل؟</h3>
          <p>{d.when}</p>
          <div className="platform-contact-address">
            <small>البريد الإلكتروني</small>
            <bdi dir="ltr">{d.contact}</bdi>
          </div>
          <Link
            className="platform-button"
            to={`/assistant?q=${encodeURIComponent(`ما مهام ${d.name}؟`)}`}
          >
            <Sparkles size={16} />
            اسأل مسار عن القسم
          </Link>
        </aside>
      </div>
      <SourceLink id={`department-${d.id}`} />
    </>
  );
}
const policyCards = [
  {
    id: "leave",
    name: "طلب الإجازة",
    about: "من إرسال الطلب إلى مديرك، حتى تأكيد تسجيله لدى الموارد البشرية.",
    department: "hr",
    label: "الموارد البشرية (HR)",
    icon: BookOpen,
  },
  {
    id: "it",
    name: "طلب الدعم التقني",
    about: "صف المشكلة بوضوح واعرف ما تحتاج إلى مشاركته مع فريق الدعم.",
    department: "it",
    label: "تقنية المعلومات (IT)",
    icon: Building2,
  },
  {
    id: "vpn",
    name: "طلب الوصول التقني (VPN)",
    about: "خطوات طلب الصلاحية والإعداد والمصادقة متعددة العوامل (MFA).",
    department: "it",
    label: "تقنية المعلومات (IT)",
    icon: RouteIcon,
  },
];
export function PoliciesPage() {
  return (
    <>
      <p className="platform-intro">
        اعثر على الإجراء المناسب، وافهم خطواته والجهة التي تساعدك في تنفيذه.
      </p>
      <div className="platform-procedure-list">
        {policyCards.map((p, i) => (
          <Link
            className="platform-procedure-row"
            key={p.id}
            to={`/policies/${p.id}`}
          >
            <span className="platform-procedure-number">0{i + 1}</span>
            <div>
              <span className="platform-procedure-owner">{p.label}</span>
              <h2>{p.name}</h2>
              <p>{p.about}</p>
            </div>
            <span className="platform-procedure-action">
              خطوات الإجراء
              <ArrowUpLeft size={18} />
            </span>
          </Link>
        ))}
      </div>
      <div className="platform-help-strip">
        <span className="platform-card-icon">
          <Sparkles size={22} />
        </span>
        <div>
          <h2>لست متأكدًا من الإجراء المناسب؟</h2>
          <p>تحدث مع مسار ليُساعدك في الوصول إلى المعلومة أو القسم المناسب.</p>
        </div>
        <Link className="platform-button secondary" to="/assistant">
          اسأل مسار
          <ArrowUpLeft size={16} />
        </Link>
      </div>
    </>
  );
}
export function Procedure({ onboarding = false }: { onboarding?: boolean }) {
  const { id } = useParams();
  const doc = knowledge.find((d) => d.id === (onboarding ? "onboarding" : id));
  const policy = policyCards.find((p) => p.id === id);
  if (!doc || (!onboarding && !policy)) return <Missing />;
  const q = onboarding
    ? "كيف أبدأ أول يوم؟"
    : doc.id === "leave"
      ? "كيف أطلب إجازة؟"
      : doc.id === "vpn"
        ? "كيف أفعل VPN؟"
        : "أحتاج دعم تقني";
  return (
    <>
      {!onboarding && (
        <Link className="platform-back" to="/policies">
          <ArrowRight size={15} />
          جميع الإجراءات
        </Link>
      )}
      <div className="platform-guide-layout">
        <div>
          <section className="platform-guide-intro">
            <span className="platform-eyebrow">
              {onboarding ? "بداية الرحلة" : "دليل الإجراء"}
            </span>
            <h2>{onboarding ? "خطوات صغيرة، لبداية واثقة." : policy?.name}</h2>
            <p>
              {onboarding
                ? "ابدأ بالتعارف، جهّز أدواتك، ثم تعرّف على دورك مع الفريق. اتبع هذا المسار لبداية أكثر وضوحًا."
                : "اتبع الخطوات التالية، وارجع إلى المصدر عند الحاجة إلى تفاصيل الإجراء."}
            </p>
          </section>
          <ol className="platform-steps">
            {doc.steps.map((s, i) => (
              <li key={s}>
                <span className="platform-step-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <span className="platform-eyebrow">الخطوة {i + 1}</span>
                  <h3>
                    {onboarding
                      ? [
                          "اليوم الأول والتعارف",
                          "تجهيزات العمل والوصول",
                          "التعرّف على المهام",
                        ][i]
                      : ["ابدأ الطلب", "تابع الإجراء", "أكمل الخطوة الأخيرة"][
                          i
                        ]}
                  </h3>
                  <p>{s}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <aside className="platform-guide-aside">
          <span className="platform-card-icon">
            <Compass size={25} />
          </span>
          <h3>معك في الخطوة التالية.</h3>
          <p>اسأل عن أي خطوة، ثم تابع الحوار حتى تتضح لك المعلومة.</p>
          <Link
            className="platform-button"
            to={`/assistant?q=${encodeURIComponent(q)}`}
          >
            ناقش الإجراء مع مسار
            <ArrowUpLeft size={16} />
          </Link>
          <div className="platform-guide-related">
            <small>جهات تساعدك</small>
            {(onboarding
              ? departments.filter((d) => ["hr", "it"].includes(d.id))
              : departments.filter((d) => d.id === policy?.department)
            ).map((d) => (
              <Link key={d.id} to={`/departments/${d.id}`}>
                {d.name}
                <bdi>({d.term})</bdi>
                <ChevronLeft size={13} />
              </Link>
            ))}
          </div>
        </aside>
      </div>
      <SourceLink id={doc.id} />
    </>
  );
}
function documentCategory(id: string) {
  return id.startsWith("department-")
    ? "الأقسام"
    : id === "company"
      ? "الشركة"
      : "الإجراءات والأدلة";
}
export function DocumentsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("الكل");
  const filtered = knowledge.filter(
    (d) =>
      (category === "الكل" || documentCategory(d.id) === category) &&
      clean(`${d.title} ${d.steps.join(" ")}`).includes(clean(query.trim())),
  );
  return (
    <>
      <p className="platform-intro">
        أدلتك ومرجع معلوماتك. استعرض المستندات وافتح المصدر الذي تحتاجه.
      </p>
      <div className="platform-document-toolbar">
        <SearchField
          value={query}
          onChange={setQuery}
          label="البحث في المستندات"
          placeholder="ابحث في العناوين والمحتوى…"
        />
        <span className="platform-result-count" aria-live="polite">
          {filtered.length} مستندًا
        </span>
      </div>
      <div
        className="platform-filter-tabs"
        role="group"
        aria-label="تصنيف المستندات"
      >
        {["الكل", "الشركة", "الأقسام", "الإجراءات والأدلة"].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {!filtered.length ? (
        <EmptySearch
          onClear={() => {
            setQuery("");
            setCategory("الكل");
          }}
        />
      ) : (
        <div className="platform-documents">
          <div className="platform-document-table-heading" aria-hidden="true">
            <span>المستند</span>
            <span>التصنيف</span>
            <span>الصيغة</span>
            <span />
          </div>
          {filtered.map((d) => (
            <Link
              key={d.id}
              className="platform-document"
              to={`/documents/${d.id}`}
            >
              <div className="platform-document-name">
                <span className="platform-file-icon">
                  <FileText size={21} />
                </span>
                <div>
                  <h2>{d.title}</h2>
                  <small>{d.steps.length} مقاطع</small>
                </div>
              </div>
              <span className="platform-document-category">
                {documentCategory(d.id)}
              </span>
              <span className="platform-file-type" dir="ltr">
                TXT
              </span>
              <ArrowUpLeft size={18} />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
export function DocumentDetail() {
  const { id } = useParams();
  const doc = knowledge.find((d) => d.id === id);
  if (!doc) return <Missing />;
  const department = departments.find((d) => `department-${d.id}` === id);
  return (
    <>
      <Link className="platform-back" to="/documents">
        <ArrowRight size={15} />
        جميع المستندات
      </Link>
      <div className="platform-reading-layout">
        <article className="platform-reading">
          <div className="platform-reading-heading">
            <span className="platform-file-icon">
              <FileText size={24} />
            </span>
            <div>
              <span className="platform-eyebrow">
                {documentCategory(doc.id)}
              </span>
              <h2>{doc.title}</h2>
            </div>
          </div>
          {doc.steps.map((s, i) => (
            <section key={s} id={`part-${i + 1}`}>
              <span className="platform-eyebrow">
                المقطع {String(i + 1).padStart(2, "0")}
              </span>
              <p>{s}</p>
            </section>
          ))}
        </article>
        <aside className="platform-document-aside">
          <h3>في هذا المستند</h3>
          <nav aria-label="مقاطع المستند">
            {doc.steps.map((_, i) => (
              <a key={i} href={`#part-${i + 1}`}>
                <span>0{i + 1}</span>المقطع {i + 1}
                <ChevronLeft size={13} />
              </a>
            ))}
          </nav>
          <div className="platform-document-meta">
            <span>
              الصيغة<bdi>TXT</bdi>
            </span>
            <span>
              التصنيف<strong>{documentCategory(doc.id)}</strong>
            </span>
          </div>
          {department && (
            <Link
              className="platform-text-link"
              to={`/departments/${department.id}`}
            >
              افتح صفحة قسم {department.name}
              <ArrowUpLeft size={15} />
            </Link>
          )}
          <Link className="platform-button" to="/assistant">
            <Sparkles size={16} />
            ناقش المعلومات مع مسار
          </Link>
        </aside>
      </div>
    </>
  );
}
