import { Link, useParams } from "react-router-dom";
import {
  ArrowUpLeft,
  Building2,
  BookOpen,
  Compass,
  FileText,
  Sparkles,
} from "lucide-react";
import { departments } from "./catalog";
import { knowledge } from "./knowledge";
export function Missing() {
  return (
    <section className="platform-empty">
      <Compass size={36} />
      <h2>هذه الصفحة غير موجودة</h2>
      <p>اختر صفحة من القائمة أو عُد للرئيسية.</p>
      <Link className="platform-button" to="/demo">
        الرئيسية
      </Link>
    </section>
  );
}
function SourceLink({ id }: { id: string }) {
  const doc = knowledge.find((d) => d.id === id);
  return doc ? (
    <Link className="platform-source" to={`/demo/documents/${doc.id}`}>
      <FileText size={16} />
      المصدر التجريبي: {doc.title}
      <ArrowUpLeft size={15} />
    </Link>
  ) : null;
}
export function Home() {
  return (
    <>
      <section className="platform-hero">
        <div>
          <span className="demo-pill">بدايتك، بخطوات أوضح</span>
          <h2>
            أهلًا بك في مسار.
            <br />
            كل ما تحتاجه لتبدأ بثقة.
          </h2>
          <p>
            {knowledge[0].steps[0]} استكشف الأقسام، تعرّف على الإجراءات، واسأل
            المساعد عندما تحتاج توجيهًا.
          </p>
          <div className="platform-actions">
            <Link className="platform-button" to="/demo/onboarding">
              ابدأ رحلتك
              <ArrowUpLeft size={18} />
            </Link>
            <Link to="/demo/assistant">تحدث مع مسار الذكي ←</Link>
          </div>
        </div>
        <div className="platform-hero-mark" aria-hidden="true">
          <Compass size={100} strokeWidth={1} />
          <span>معرفة ترشدك.</span>
        </div>
      </section>
      <div className="platform-section-heading">
        <h2>وجهتك الأولى</h2>
        <span>اكتشف · افهم · اسأل</span>
      </div>
      <div className="platform-grid">
        {[
          {
            path: "departments",
            title: "دليل الأقسام",
            text: "اعرف من يفعل ماذا، وإلى من تتوجه.",
            icon: Building2,
          },
          {
            path: "documents",
            title: "معرفة لها مصدر",
            text: "وثائق مترابطة يمكنك الرجوع إلى نصوصها.",
            icon: BookOpen,
          },
          {
            path: "assistant",
            title: "مسار الذكي (MASAR AI)",
            text: "اسأل وتابع الحوار، مع مصادر واضحة وحدود معلنة.",
            icon: Sparkles,
          },
        ].map((c) => (
          <Link
            className="platform-card platform-link-card"
            key={c.path}
            to={`/demo/${c.path}`}
          >
            <c.icon size={25} />
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <span>
              استكشف
              <ArrowUpLeft size={16} />
            </span>
          </Link>
        ))}
      </div>
      <section className="platform-company">
        <div>
          <span className="eyebrow">تعرّف على مساحة العرض</span>
          <h2>شركة مسار التجريبية</h2>
          <p>
            بيئة تعليمية لتجربة رحلة الموظف الجديد. جميع الأقسام والإجراءات
            وجهات الاتصال افتراضية ومخصصة للعرض فقط.
          </p>
          <SourceLink id="company" />
        </div>
        <Link to="/demo/departments">استعرض أقسام الشركة ←</Link>
      </section>
    </>
  );
}
export function DepartmentsPage() {
  return (
    <>
      <p className="platform-intro">
        من الموارد البشرية إلى العمليات؛ تعرّف على مسؤولية كل فريق والخدمات التي
        يقدمها في هذا المثال التجريبي.
      </p>
      <div className="platform-grid">
        {departments.map((d) => (
          <Link
            className="platform-card platform-link-card"
            key={d.id}
            to={`/demo/departments/${d.id}`}
          >
            <span className="platform-monogram" dir="ltr">
              {d.term}
            </span>
            <h2>
              {d.name} <bdi>({d.term})</bdi>
            </h2>
            <p>{d.about}</p>
            <span>
              تفاصيل القسم
              <ArrowUpLeft size={16} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
export function DepartmentDetail() {
  const { id } = useParams();
  const d = departments.find((x) => x.id === id);
  if (!d) return <Missing />;
  return (
    <>
      <Link className="platform-back" to="/demo/departments">
        ← جميع الأقسام
      </Link>
      <section className="platform-detail-hero">
        <span className="platform-monogram">{d.term}</span>
        <h2>
          {d.name} <bdi>({d.term})</bdi>
        </h2>
        <p>{d.about}</p>
      </section>
      <div className="platform-grid two">
        <section className="platform-card">
          <h3>المهام والمسؤوليات</h3>
          <ul>
            {d.responsibilities.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="platform-card">
          <h3>الخدمات التي يقدمها</h3>
          <ul>
            {d.services.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className="platform-card">
          <h3>متى تحتاج إلى التواصل؟</h3>
          <p>{d.when}</p>
        </section>
        <section className="platform-card">
          <h3>بيانات التواصل التجريبية</h3>
          <p>
            <bdi dir="ltr">{d.contact}</bdi>
          </p>
          <p>
            عنوان افتراضي غير قابل للمراسلة. لا توجد جهة اتصال حقيقية في نسخة
            العرض.
          </p>
        </section>
      </div>
      <SourceLink id={`department-${d.id}`} />
      <Link
        className="platform-button"
        to={`/demo/assistant?q=${encodeURIComponent(`ما مهام ${d.name}؟`)}`}
      >
        اسأل مسار عن القسم
        <ArrowUpLeft size={16} />
      </Link>
    </>
  );
}
const policyCards = [
  {
    id: "leave",
    name: "طلب الإجازة",
    about: "من طلب المدير إلى تأكيد التسجيل لدى الموارد البشرية.",
  },
  {
    id: "it",
    name: "طلب الدعم التقني",
    about: "كيف تصف المشكلة وتحافظ على سرية بياناتك.",
  },
  {
    id: "vpn",
    name: "طلب الوصول التقني (VPN)",
    about: "الصلاحية، العميل المعتمد، والمصادقة متعددة العوامل (MFA).",
  },
];
export function PoliciesPage() {
  return (
    <>
      <p className="platform-intro">
        إجراءات تعليمية مبسطة فقط؛ لا تمثل سياسة عمل حقيقية ولا تحدد استحقاقات
        أو مددًا ملزمة.
      </p>
      <div className="platform-grid">
        {policyCards.map((p) => (
          <Link
            className="platform-card platform-link-card"
            key={p.id}
            to={`/demo/policies/${p.id}`}
          >
            <BookOpen />
            <h2>{p.name}</h2>
            <p>{p.about}</p>
            <span>
              عرض الإجراء
              <ArrowUpLeft size={16} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
export function Procedure({ onboarding = false }: { onboarding?: boolean }) {
  const { id } = useParams();
  const doc = knowledge.find((d) => d.id === (onboarding ? "onboarding" : id));
  if (!doc || (!onboarding && !policyCards.some((p) => p.id === id)))
    return <Missing />;
  return (
    <>
      <p className="platform-intro">
        {onboarding
          ? "دليلك في اليوم الأول: ابدأ بالتعارف، جهّز أدواتك، ثم افهم دورك مع الفريق."
          : "تسلسل الإجراء كما هو موثّق في البيانات التجريبية؛ دون إضافة شروط أو سياسات غير منشورة."}
      </p>
      <ol className="platform-steps">
        {doc.steps.map((s, i) => (
          <li key={s}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2>
                {onboarding
                  ? [
                      "اليوم الأول والتعارف",
                      "تجهيزات العمل والوصول",
                      "التعرّف على المهام",
                    ][i]
                  : `الخطوة ${i + 1}`}
              </h2>
              <p>{s}</p>
            </div>
          </li>
        ))}
      </ol>
      <SourceLink id={doc.id} />
      <div className="platform-actions">
        <Link
          className="platform-button"
          to={`/demo/assistant?q=${encodeURIComponent(onboarding ? "كيف أبدأ أول يوم؟" : doc.id === "leave" ? "كيف أطلب إجازة؟" : doc.id === "vpn" ? "كيف أفعل VPN؟" : "أحتاج دعم تقني")}`}
        >
          ناقش الإجراء مع مسار
          <ArrowUpLeft size={16} />
        </Link>
        <Link to="/demo/departments">اعرف القسم المناسب ←</Link>
      </div>
    </>
  );
}
export function DocumentsPage() {
  return (
    <>
      <p className="platform-intro">
        نصوص محلية جاهزة للعرض، وليست ملفات مرفوعة أو معالجة فعليًا. المصدر نفسه
        متاح للمساعد ولصفحات المنصة.
      </p>
      <div className="platform-documents">
        {knowledge.map((d) => (
          <Link
            key={d.id}
            to={`/demo/documents/${d.id}`}
            className="platform-document"
          >
            <span className="platform-file-icon">
              <FileText />
            </span>
            <div>
              <h2>{d.title}</h2>
              <p>نص تجريبي (TXT) · محفوظ ضمن نسخة العرض</p>
            </div>
            <span className="demo-status verified">جاهز للعرض · تجريبي</span>
            <ArrowUpLeft size={18} />
          </Link>
        ))}
      </div>
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
      <Link className="platform-back" to="/demo/documents">
        ← جميع المستندات
      </Link>
      <article className="platform-reading">
        <span className="demo-status verified">
          مصدر تجريبي محلي · دون رفع أو معالجة
        </span>
        <h2>{doc.title}</h2>
        {doc.steps.map((s, i) => (
          <section key={s}>
            <h3>المقطع {i + 1}</h3>
            <p>{s}</p>
          </section>
        ))}
      </article>
      {department && (
        <Link
          className="platform-source"
          to={`/demo/departments/${department.id}`}
        >
          افتح صفحة قسم {department.name} ←
        </Link>
      )}
      <Link className="platform-button" to="/demo/assistant">
        ناقش المعلومات مع مسار
        <ArrowUpLeft size={16} />
      </Link>
    </>
  );
}
