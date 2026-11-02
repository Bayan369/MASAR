import { apiRequest } from "../lib/api";
import { readReducedMotion, saveReducedMotion } from "../lib/preferences";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, X, Info, Check, Server } from "lucide-react";
import { getDemoDocuments, type DemoDocument } from "../lib/assistant";
import QuestionBox from "../components/QuestionBox";
import { EmptyState, Icon, PageHeading, Term } from "../components/ui";
import { departments } from "../lib/content";
export function Assistant() {
  return (
    <>
      <PageHeading
        eyebrow="مساحة للأسئلة، وطريق إلى المعرفة"
        title={
          <>
            المساعد الذكي <Term>AI Assistant</Term>
          </>
        }
        description="اسأل بالعربية أو الإنجليزية، مع الاحتفاظ بالمصطلحات التقنية مثل VPN وCRM وAPI وMFA."
      />
      <div className="notice">
        <Info size={19} />
        <p>
          تجربة لشركة «مسار التجريبية» بوثائق توضيحية ثابتة، وليست سياسات شركة
          حقيقية. تُرسل الأسئلة إلى Cloudflare لتوليد الإجابة؛ لا تدخل بيانات
          شخصية أو سرية.
        </p>
      </div>
      <QuestionBox full />
      <div className="principles">
        <div>
          <Icon name="knowledge" />
          <h3>إجابة بمراجعها</h3>
          <p>الوصول إلى المصدر الأصلي سيكون جزءًا من كل إجابة.</p>
        </div>
        <div>
          <Icon name="it" />
          <h3>مصطلحاتك كما هي</h3>
          <p>العربية أولًا، مع إبقاء المصطلحات التقنية باللغة الإنجليزية.</p>
        </div>
        <div>
          <Icon name="qa" />
          <h3>وضوح قبل كل شيء</h3>
          <p>عندما لا يتوفر مصدر موثوق، سيُوضَّح ذلك بصراحة.</p>
        </div>
      </div>
    </>
  );
}
export function Departments() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const selected = departments.find((d) => d.term === params.get("department"));
  const filtered = departments.filter((d) =>
    (d.name + " " + d.term).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="اعرف الوجهة المناسبة"
        title={
          <>
            الأقسام <Term>Departments</Term>
          </>
        }
        description="دليل استرشادي لمسؤوليات الأقسام. معلومات الاتصال والهيكل الفعلي للشركة لم تُربط بعد."
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="البحث في الأقسام"
            placeholder="ابحث باسم القسم أو اختصاره…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="muted">دليل استرشادي</span>
      </div>
      {selected && (
        <section className="department-detail">
          <button
            className="icon-button"
            aria-label="إغلاق تفاصيل القسم"
            onClick={() => setParams({})}
          >
            <X size={18} />
          </button>
          <Icon name={selected.icon} size={28} />
          <h2>
            {selected.name} <Term>{selected.term}</Term>
          </h2>
          <p>{selected.description}</p>
          <p className="muted">
            لم تُضف بيانات مسؤولي القسم أو وسائل التواصل بعد.
          </p>
        </section>
      )}
      <div className="department-grid">
        {filtered.map((d) => (
          <button
            key={d.term}
            className={
              "department-card " + (selected?.term === d.term ? "selected" : "")
            }
            onClick={() => setParams({ department: d.term })}
          >
            <span className={"department-icon " + d.icon}>
              <Icon name={d.icon} size={25} />
            </span>
            <h2>
              {d.name} <Term>{d.term}</Term>
            </h2>
            <p>{d.description}</p>
            <span className="text-link">
              استكشف مسؤوليات القسم<span aria-hidden="true">↖</span>
            </span>
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <EmptyState
          title="لم نجد قسمًا بهذا الاسم"
          description="جرّب البحث بالعربية أو باستخدام الاختصار الإنجليزي."
          icon="departments"
        />
      )}
    </>
  );
}
export function Knowledge() {
  const [filter, setFilter] = useState("جميع المستندات");
  const [search, setSearch] = useState("");
  const [documents, setDocuments] = useState<DemoDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getDemoDocuments(controller.signal)
      .then(setDocuments)
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "تعذّر تحميل الوثائق.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const selected = documents.find((d) => d.id === params.get("document"));
  const filtered = documents.filter(
    (d) =>
      (filter === "جميع المستندات" || d.category === filter) &&
      (
        d.title +
        " " +
        d.sections.map((s) => s.title + " " + s.content).join(" ")
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="اقرأ المصدر بنفسك"
        title={
          <>
            قاعدة المعرفة <Term>Knowledge Base</Term>
          </>
        }
        description="أربع وثائق ثابتة لشركة مسار التجريبية. المحتوى للتجربة فقط وليس سياسة صاحب عمل حقيقي."
      />
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="البحث في المستندات"
            placeholder="ابحث عن سياسة أو إجراء…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="filter-tabs" role="group" aria-label="تصفية نوع المستند">
        {["جميع المستندات", "السياسات", "الأدلة"].map((f) => (
          <button
            key={f}
            aria-pressed={f === filter}
            className={f === filter ? "selected" : ""}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      {loading && (
        <p role="status" className="notice">
          جارٍ تحميل الوثائق التجريبية…
        </p>
      )}
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => setRetry((r) => r + 1)}
          >
            إعادة التحميل
          </button>
        </div>
      )}
      {!loading && !error && (
        <div className="demo-document-grid">
          {filtered.map((d) => (
            <button
              className={
                "demo-document-card " +
                (selected?.id === d.id ? "selected" : "")
              }
              key={d.id}
              onClick={() => setParams({ document: d.id })}
            >
              <Icon name="knowledge" />
              <span className="pill">وثيقة تجريبية</span>
              <h2>{d.title}</h2>
              <p>{d.category}</p>
              <span className="text-link">قراءة الوثيقة الأصلية ↖</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          icon="knowledge"
          title="لا توجد مستندات مطابقة"
          description="جرّب كلمة أخرى أو غيّر نوع المستند."
        />
      )}
      {selected && (
        <article className="surface demo-document-reader">
          <button
            className="icon-button"
            aria-label="إغلاق الوثيقة"
            onClick={() => setParams({})}
          >
            <X size={18} />
          </button>
          <p className="eyebrow">وثيقة تجريبية — ليست سياسة شركة حقيقية</p>
          <h2>{selected.title}</h2>
          {selected.sections.map((s) => (
            <section key={s.title}>
              <h3>{s.title}</h3>
              <p dir="auto">{s.content}</p>
            </section>
          ))}
        </article>
      )}
    </>
  );
}
export function History() {
  return (
    <>
      <PageHeading
        eyebrow="ارجع إلى ما تعلّمته"
        title={
          <>
            المحادثات السابقة <Term>Conversation History</Term>
          </>
        }
        description="مساحة للعودة إلى أسئلتك وإجاباتها ومراجعها عند تفعيل الخدمة."
      />
      <section className="surface">
        <EmptyState
          title="لم تبدأ محادثتك الأولى بعد"
          description="المحادثات غير متاحة للحفظ حاليًا. يمكنك استكشاف واجهة المساعد إلى حين إتاحة حفظ المحادثات."
        >
          <Link className="primary-button" to="/assistant">
            استكشف المساعد الذكي
          </Link>
        </EmptyState>
      </section>
    </>
  );
}
export function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [motion, setMotion] = useState(readReducedMotion);
  const [storageError, setStorageError] = useState(false);
  function save() {
    const stored = saveReducedMotion(motion);
    setSaved(stored);
    setStorageError(!stored);
  }
  return (
    <>
      <PageHeading
        eyebrow="مساحة تناسبك"
        title={
          <>
            الملف الشخصي والإعدادات <Term>Profile & Settings</Term>
          </>
        }
        description="إعدادات العرض المحلية ومعلومات حسابك عند تفعيل تسجيل الدخول."
      />
      <div className="settings-grid">
        <section className="surface settings-panel">
          <h2>الملف الشخصي</h2>
          <EmptyState
            icon="hr"
            title="لم يتم تسجيل الدخول"
            description="خدمة المصادقة غير متصلة بعد. يلزم تفعيلها لعرض بيانات حسابك."
          >
            <Link className="secondary-button" to="/login">
              انتقل إلى تسجيل الدخول
            </Link>
          </EmptyState>
        </section>
        <section className="surface settings-panel">
          <h2>تفضيلات العرض</h2>
          <div className="setting-row">
            <div>
              <h3>لغة الواجهة</h3>
              <p>العربية — من اليمين إلى اليسار</p>
            </div>
            <span className="pill">مفعّلة</span>
          </div>
          <p className="muted small">
            الواجهة الإنجليزية مخطط لها في مرحلة لاحقة.
          </p>
          <label className="setting-row">
            <div>
              <h3>تقليل الحركة</h3>
              <p>تخفيف الانتقالات في هذا المتصفّح.</p>
            </div>
            <input
              type="checkbox"
              checked={motion}
              onChange={(e) => {
                setMotion(e.target.checked);
                setSaved(false);
              }}
            />
          </label>
          <button className="primary-button" onClick={save}>
            حفظ التفضيلات
          </button>
          {storageError && (
            <p className="field-error" role="alert">
              طُبّقت التفضيلات مؤقتًا. تعذّر حفظها لأن تخزين المتصفّح غير متاح.
            </p>
          )}
          {saved && (
            <p className="success-message" role="status">
              <Check size={17} />
              حُفظت التفضيلات في هذا المتصفّح.
            </p>
          )}
        </section>
      </div>
      <BackendStatus />
    </>
  );
}
function BackendStatus() {
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  async function check() {
    setLoading(true);
    setState("");
    try {
      const r = await apiRequest("/health", {
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw Error();
      const data = await r.json();
      setState(
        data.status === "ok"
          ? "الخدمة الخلفية متاحة. اتصال Llama يحتاج إعداد Cloudflare؛ المصادقة غير مفعّلة."
          : "استجابة غير متوقعة من الخدمة.",
      );
    } catch {
      setState(
        "تعذّر الاتصال بالخدمة الخلفية. تأكد من تشغيلها وصحة عنوان واجهة برمجة التطبيقات (API).",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="surface api-status">
      <Server size={20} />
      <div>
        <h3>
          حالة واجهة برمجة التطبيقات <Term>API</Term>
        </h3>
        <p className="muted">تحقق من اتصال الواجهة بالخدمة الخلفية.</p>
        {state && <p role="status">{state}</p>}
      </div>
      <button className="secondary-button" disabled={loading} onClick={check}>
        {loading ? "جارٍ التحقق…" : "فحص الاتصال"}
      </button>
    </section>
  );
}
export function NotFound() {
  return (
    <EmptyState
      icon="dashboard"
      title="هذه الصفحة غير موجودة"
      description="قد يكون الرابط غير صحيح. عد إلى مساحة العمل للمتابعة."
    >
      <Link to="/" className="primary-button">
        العودة إلى لوحة التحكم
      </Link>
    </EmptyState>
  );
}
