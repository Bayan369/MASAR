import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Info, Search, X, Check } from "lucide-react";
import { api, jsonBody } from "../lib/api";
import {
  useResource,
  type Department,
  type Document,
  type Conversation,
  type Message,
} from "../lib/product";
import { useAuth } from "../auth/AuthProvider";
import QuestionBox from "../components/QuestionBox";
import { EmptyState, PageHeading, Icon } from "../components/ui";
import { readReducedMotion, saveReducedMotion } from "../lib/preferences";
function State({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: string;
  reload: () => void;
}) {
  return (
    <>
      {loading && (
        <p role="status" className="notice">
          جارٍ تحميل البيانات…
        </p>
      )}
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button className="secondary-button" onClick={reload}>
            إعادة المحاولة
          </button>
        </div>
      )}
    </>
  );
}
const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "تعذّر إتمام العملية.";
export function Assistant() {
  const [params] = useSearchParams();
  const id = params.get("conversation");
  return (
    <>
      <PageHeading
        eyebrow="اسأل من مصادر شركتك"
        title={<>المساعد الذكي</>}
        description="اسأل بالعربية أو الإنجليزية. الإجابة ترتبط بمستندات شركتك المسموح لك بها، مع مراجعها الأصلية."
      />
      <div className="notice">
        <Info size={19} />
        <p>
          لا تشارك كلمات مرور أو رموز MFA. عند غياب دليل كافٍ، سيوضح مسار عدم
          توفر المعلومة.
        </p>
      </div>
      {id && <Thread id={id} />}
      <QuestionBox full />
    </>
  );
}
function Thread({ id }: { id: string }) {
  const resource = useResource<Message[]>(
    "/conversations/" + encodeURIComponent(id) + "/messages",
  );
  return (
    <section className="surface thread">
      <h2>المحادثة السابقة</h2>
      <State {...resource} />
      {resource.data?.map((m) => (
        <article className={"thread-message " + m.role} key={m.id}>
          <h3>{m.role === "user" ? "سؤالك" : "إجابة مسار"}</h3>
          <p dir="auto">{m.content}</p>
          {m.citations?.map((s, index) => (
            <div className="history-source" key={index}>
              <Link
                className="text-link"
                to={"/knowledge?document=" + s.document_id}
              >
                {s.title}
              </Link>
              <blockquote dir="auto">{s.quote}</blockquote>
            </div>
          ))}
        </article>
      ))}
      {resource.data?.length === 0 && (
        <p className="muted">لا توجد رسائل محفوظة بعد.</p>
      )}
    </section>
  );
}
export function Departments() {
  const auth = useAuth(),
    isAdmin = auth.membership?.profile.role === "company_admin";
  const resource = useResource<Department[]>("/departments");
  const [search, setSearch] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const rows =
    resource.data?.filter((d) =>
      (d.name + " " + d.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api(
        editing ? "/departments/" + editing : "/departments",
        jsonBody({ name, description }, editing ? "PATCH" : "POST"),
      );
      setName("");
      setDescription("");
      setEditing(null);
      resource.reload();
      setMessage("حُفظ القسم بنجاح.");
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (
      !window.confirm(
        "هل تريد حذف القسم؟ لا يمكن حذف قسم مرتبط بموظفين أو مستندات.",
      )
    )
      return;
    setBusy(true);
    try {
      await api("/departments/" + id, { method: "DELETE" });
      resource.reload();
      setMessage("حُذف القسم.");
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="دليل شركتك"
        title={<>الأقسام</>}
        description="تعرّف إلى مسؤوليات الأقسام في شركتك."
      />
      <label className="search-field">
        <Search size={18} />
        <input
          aria-label="البحث في الأقسام"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث باسم القسم…"
        />
      </label>
      <State {...resource} />
      {!resource.loading && !resource.error && rows.length === 0 && (
        <EmptyState
          icon="departments"
          title="لا توجد أقسام مطابقة"
          description={
            isAdmin
              ? "أضف أقسام شركتك من النموذج أدناه."
              : "لم يضف مدير الشركة أقسامًا بعد، أو لا توجد نتيجة للبحث."
          }
        />
      )}
      <div className="department-grid">
        {rows.map((d) => (
          <article className="surface department-card" key={d.id}>
            <Icon name="departments" />
            <h2>{d.name}</h2>
            <p>{d.description || "لم يُضف وصف للقسم."}</p>
            {isAdmin && (
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={() => {
                    setEditing(d.id);
                    setName(d.name);
                    setDescription(d.description || "");
                  }}
                >
                  تعديل
                </button>
                <button
                  disabled={busy}
                  className="secondary-button"
                  onClick={() => void remove(d.id)}
                >
                  حذف
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {isAdmin && (
        <form className="surface product-form" onSubmit={save}>
          <h2>{editing ? "تعديل القسم" : "إضافة قسم"}</h2>
          <label>
            اسم القسم
            <input
              required
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            المسؤوليات والوصف
            <textarea
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="action-row">
            <button className="primary-button" disabled={busy}>
              {busy ? "جارٍ الحفظ…" : "حفظ القسم"}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditing(null);
                  setName("");
                  setDescription("");
                }}
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
const processingErrors: Record<string, string> = {
  EMPTY_OR_SCANNED_DOCUMENT:
    "لا يوجد نص قابل للاستخراج. استخدم نسخة نصية؛ الصور الممسوحة ضوئيًا غير مدعومة.",
  PDF_LIMIT_OR_ENCRYPTED: "ملف PDF مشفر أو يتجاوز 100 صفحة.",
  TEXT_LIMIT: "يتجاوز المستند 100 ألف حرف نصي.",
  CHUNK_LIMIT: "يتجاوز المستند حد 80 مقطعًا.",
  EXTRACTION_FAILED: "تعذّر استخراج النص. تحقق من سلامة الملف وترميزه.",
  CONTENT_INTEGRITY_FAILED:
    "تعذّر التحقق من سلامة الملف المخزن. احذفه وارفع نسخة سليمة.",
  UPLOAD_FAILED: "لم يكتمل رفع الملف. احذفه ثم أعد الرفع.",
  AI_BUDGET_REACHED:
    "بلغت خدمة الفهرسة حد الطلبات المحلي. يحتاج مدير النظام مراجعة الحصة قبل إعادة التشغيل.",
  AI_QUOTA_OR_RATE_LIMIT:
    "انتهت الحصة المتاحة. لا تُعد المحاولة قبل مراجعة خطة Workers Free.",
};
const statuses: Record<string, string> = {
  draft: "بانتظار المعالجة",
  processing: "قيد المعالجة",
  published: "متاح",
  failed: "تعذّرت المعالجة",
  archived: "مؤرشف",
};
export function Knowledge() {
  const isAdmin = useAuth().membership?.profile.role === "company_admin";
  const resource = useResource<Document[]>("/documents"),
    departments = useResource<Department[]>("/departments");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(""),
    [title, setTitle] = useState(""),
    [visibility, setVisibility] = useState("admins"),
    [department, setDepartment] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const pending =
    resource.data?.some(
      (d) => d.status === "draft" || d.status === "processing",
    ) || false;
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(resource.reload, 3000);
    return () => clearInterval(timer);
  }, [pending, resource.reload]);
  const selected = resource.data?.find((d) => d.id === params.get("document"));
  const filtered =
    resource.data?.filter((d) =>
      d.title.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!file || file.size === 0 || file.size > 5 * 1024 * 1024) {
      setMessage("اختر ملفًا غير فارغ حتى 5 ميغابايت.");
      return;
    }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setMessage("ندعم PDF وDOCX وTXT فقط.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("title", title);
      body.set("visibility", visibility);
      if (department) body.set("department_id", department);
      await api("/documents", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(120000),
      });
      setMessage("رُفع الملف بأمان. ستظهر حالته عند اكتمال المعالجة.");
      setTitle("");
      setFile(null);
      resource.reload();
      (e.target as HTMLFormElement).reset();
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  async function action(id: string, kind: "retry" | "delete") {
    if (
      kind === "delete" &&
      !window.confirm("حذف المستند ومقاطعه من مصادر المساعد؟")
    )
      return;
    setBusy(true);
    try {
      await api("/documents/" + id + (kind === "retry" ? "/retry" : ""), {
        method: kind === "retry" ? "POST" : "DELETE",
      });
      setMessage(
        kind === "retry"
          ? "أُعيد المستند إلى قائمة المعالجة."
          : "حُذف المستند.",
      );
      resource.reload();
      if (kind === "delete") setParams({});
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="المعلومة من مصدرها"
        title={<>قاعدة المعرفة</>}
        description="مستندات الشركة المسموح لك بالوصول إليها. يعتمد المساعد على المحتوى المعالج والمنشور فقط."
      />
      <label className="search-field">
        <Search size={18} />
        <input
          aria-label="البحث في المستندات"
          placeholder="ابحث بعنوان المستند…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <State {...resource} />
      <div className="demo-document-grid">
        {filtered.map((d) => (
          <article className="demo-document-card" key={d.id}>
            <span className="pill">{statuses[d.status] || d.status}</span>
            <Icon name="knowledge" />
            <h2>{d.title}</h2>
            <p>{d.original_name}</p>
            {isAdmin && (
              <DocumentEditor
                document={d}
                departments={departments.data || []}
                reload={resource.reload}
              />
            )}
            <button
              className="text-link"
              onClick={() => setParams({ document: d.id })}
            >
              قراءة المصدر
            </button>
            {d.processing_error && (
              <p className="field-error">
                {processingErrors[d.processing_error] ||
                  "تعذّرت المعالجة أو خدمة الفهرسة. راجع مدير النظام قبل إعادة المحاولة."}
              </p>
            )}
            {isAdmin && (
              <div className="action-row">
                {d.status === "failed" && d.uploaded_at && (
                  <button
                    disabled={busy}
                    className="secondary-button"
                    onClick={() => void action(d.id, "retry")}
                  >
                    إعادة المعالجة
                  </button>
                )}
                <button
                  disabled={busy}
                  className="secondary-button"
                  onClick={() => void action(d.id, "delete")}
                >
                  حذف
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!resource.loading && !resource.error && filtered.length === 0 && (
        <EmptyState
          icon="knowledge"
          title="لا توجد مستندات متاحة"
          description={
            isAdmin
              ? "ارفع أول مستند للشركة أدناه."
              : "لا توجد مستندات منشورة تسمح صلاحياتك بعرضها."
          }
        />
      )}
      {selected && (
        <DocumentReader
          key={selected.id}
          document={selected}
          onClose={() => setParams({})}
        />
      )}
      {!selected && params.get("document") && (
        <OpenDocument
          key={params.get("document")}
          id={params.get("document")!}
          onClose={() => setParams({})}
        />
      )}
      {isAdmin && (
        <form
          className="surface product-form"
          onSubmit={upload}
          aria-busy={busy}
        >
          <h2>رفع مستند</h2>
          <p className="muted">
            PDF وDOCX وTXT حتى 5 ميغابايت. الصور الممسوحة ضوئيًا تحتاج نسخة
            نصية.
          </p>
          <label>
            العنوان
            <input
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            الملف
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              required
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <label>
            من يستطيع قراءته؟
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="admins">مديرو الشركة فقط</option>
              <option value="company">جميع موظفي الشركة</option>
              <option value="department">قسم محدد</option>
            </select>
          </label>
          {visibility === "department" && (
            <label>
              القسم
              <select
                required
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">اختر القسم</option>
                {departments.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "جارٍ الرفع…" : "رفع المستند"}
          </button>
        </form>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
function DocumentReader({
  document,
  onClose,
}: {
  document: Document;
  onClose: () => void;
}) {
  const resource = useResource<
    { id: string; content: string; page_number: number | null }[]
  >("/documents/" + document.id + "/chunks");
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  async function download() {
    try {
      const result = await api<{ url: string }>(
        "/documents/" + document.id + "/download",
      );
      setUrl(result.url);
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }
  return (
    <article className="surface demo-document-reader">
      <button
        className="icon-button"
        aria-label="إغلاق الوثيقة"
        onClick={onClose}
      >
        <X size={18} />
      </button>
      <h2>{document.title}</h2>
      <button className="secondary-button" onClick={() => void download()}>
        إنشاء رابط الملف الأصلي
      </button>
      {url && (
        <a
          className="text-link"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          فتح الملف الأصلي — الرابط صالح لدقيقة
        </a>
      )}
      {error && <p role="alert">{error}</p>}
      <State {...resource} />
      {resource.data?.map((chunk) => (
        <section key={chunk.id}>
          {chunk.page_number && (
            <h3>
              صفحة <bdi>{chunk.page_number}</bdi>
            </h3>
          )}
          <p dir="auto">{chunk.content}</p>
        </section>
      ))}
      {resource.data?.length === 0 && (
        <p className="muted">
          لم تُستخرج مقاطع نصية بعد. تحقق من حالة المعالجة.
        </p>
      )}
    </article>
  );
}
export function History() {
  const resource = useResource<Conversation[]>("/conversations");
  const [message, setMessage] = useState("");
  async function remove(id: string) {
    if (!window.confirm("حذف هذه المحادثة ورسائلها؟")) return;
    try {
      await api("/conversations/" + id, { method: "DELETE" });
      resource.reload();
    } catch (e) {
      setMessage(messageOf(e));
    }
  }
  async function rename(c: Conversation) {
    const title = window.prompt("عنوان المحادثة", c.title || "");
    if (!title?.trim()) return;
    try {
      await api(
        "/conversations/" + c.id,
        jsonBody({ title: title.trim() }, "PATCH"),
      );
      resource.reload();
    } catch (e) {
      setMessage(messageOf(e));
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="معرفتك السابقة"
        title={<>المحادثات السابقة</>}
        description="محادثاتك الخاصة فقط. تُخفى الإجابات التي لم تعد مصادرها متاحة لك."
      />
      <State {...resource} />
      {resource.data?.map((c) => (
        <article className="surface history-row" key={c.id}>
          <Link to={"/assistant?conversation=" + c.id}>
            <h2>{c.title || "محادثة دون عنوان"}</h2>
            <small>{new Date(c.updated_at).toLocaleString("ar-SA")}</small>
          </Link>
          <div className="action-row">
            <button className="secondary-button" onClick={() => void rename(c)}>
              تغيير العنوان
            </button>
            <button
              className="secondary-button"
              onClick={() => void remove(c.id)}
            >
              حذف
            </button>
          </div>
        </article>
      ))}
      {resource.data?.length === 0 && (
        <EmptyState
          title="لا توجد محادثات بعد"
          description="ابدأ بسؤال؛ تُحفظ الإجابة ومصادرها بعد إتمام الطلب."
        >
          <Link className="primary-button" to="/assistant">
            اسأل مسار
          </Link>
        </EmptyState>
      )}
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
    </>
  );
}
export function SettingsPage() {
  const auth = useAuth();
  const [name, setName] = useState(auth.membership?.profile.display_name || ""),
    [company, setCompany] = useState(auth.membership?.company.name || ""),
    [motion, setMotion] = useState(readReducedMotion),
    [message, setMessage] = useState("");
  const isAdmin = auth.membership?.profile.role === "company_admin";
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/profile", jsonBody({ display_name: name }, "PATCH"));
      const stored = saveReducedMotion(motion);
      setMessage(
        stored
          ? "حُفظت إعداداتك."
          : "حُفظ الاسم؛ تعذّر حفظ تفضيل الحركة محليًا.",
      );
      auth.reload();
    } catch (e) {
      setMessage(messageOf(e));
    }
  }
  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/company", jsonBody({ name: company }, "PATCH"));
      setMessage("حُفظ اسم الشركة.");
      auth.reload();
    } catch (e) {
      setMessage(messageOf(e));
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="حسابك ومساحتك"
        title={<>الملف الشخصي والإعدادات</>}
        description="بياناتك وتفضيلات العرض. لا يمكن تعديل الدور أو الشركة من ملف الموظف."
      />
      <form className="surface product-form" onSubmit={save}>
        <label>
          الاسم المعروض
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <p>
          الدور:{" "}
          {isAdmin
            ? "مدير الشركة (Company Admin)"
            : "الموظف الجديد (New Employee)"}
        </p>
        <label className="setting-row">
          تقليل الحركة
          <input
            type="checkbox"
            checked={motion}
            onChange={(e) => setMotion(e.target.checked)}
          />
        </label>
        <button className="primary-button">حفظ الإعدادات</button>
        <Link className="text-link" to="/reset-password">
          تغيير كلمة المرور
        </Link>
      </form>
      {isAdmin && (
        <>
          <form className="surface product-form" onSubmit={saveCompany}>
            <h2>إدارة الشركة</h2>
            <label>
              اسم الشركة
              <input
                required
                maxLength={200}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            <button className="primary-button">حفظ اسم الشركة</button>
          </form>
          <Members />
        </>
      )}
      {message && (
        <p className="notice" role="status">
          <Check size={17} />
          {message}
        </p>
      )}
    </>
  );
}
interface Member {
  id: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  department_id: string | null;
}
function Members() {
  const currentUser = useAuth().membership?.profile.id;

  const resource = useResource<Member[]>("/members"),
    departments = useResource<Department[]>("/departments");
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [department, setDepartment] = useState(""),
    [role, setRole] = useState("new_employee"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/members/invite",
        jsonBody({
          email,
          display_name: name,
          department_id: department || null,
          role,
        }),
      );
      setMessage("أُرسلت الدعوة وأُنشئت العضوية.");
      setEmail("");
      setName("");
      resource.reload();
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface product-form">
      <h2>أعضاء الشركة ودعوات الانضمام</h2>
      <State {...resource} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الدور</th>
              <th>إدارة الصلاحيات</th>
            </tr>
          </thead>
          <tbody>
            {resource.data?.map((m) => (
              <tr key={m.id}>
                <td>{m.display_name || "لم يُضف اسم"}</td>
                <td>
                  {m.role === "company_admin" ? "مدير الشركة" : "الموظف الجديد"}
                </td>
                <td>
                  {m.id !== currentUser ? (
                    <MemberEditor
                      member={m}
                      departments={departments.data || []}
                      reload={resource.reload}
                    />
                  ) : (
                    "حسابك الحالي"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={invite}>
        <label>
          اسم المدعو
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          الدور
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="new_employee">الموظف الجديد</option>
            <option value="company_admin">مدير الشركة</option>
          </select>
        </label>
        <label>
          القسم
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">دون قسم</option>
            {departments.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" disabled={busy}>
          {busy ? "جارٍ إرسال الدعوة…" : "دعوة عضو"}
        </button>
      </form>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
export function NotFound() {
  return (
    <EmptyState
      icon="dashboard"
      title="هذه الصفحة غير موجودة"
      description="تحقق من الرابط أو عد إلى مساحة العمل."
    >
      <Link className="primary-button" to="/">
        العودة إلى لوحة التحكم
      </Link>
    </EmptyState>
  );
}

function DocumentEditor({
  document,
  departments,
  reload,
}: {
  document: Document;
  departments: Department[];
  reload: () => void;
}) {
  const [title, setTitle] = useState(document.title),
    [scope, setScope] = useState(document.visibility),
    [department, setDepartment] = useState(document.department_id || ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/documents/" + document.id,
        jsonBody(
          {
            title,
            visibility: scope,
            department_id: scope === "department" ? department : null,
          },
          "PATCH",
        ),
      );
      setMessage("حُفظت صلاحيات المستند.");
      reload();
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="document-edit">
      <summary>تعديل العنوان والصلاحيات</summary>
      <form className="product-form" onSubmit={save}>
        <label>
          عنوان المستند
          <input
            required
            maxLength={300}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          نطاق الوصول
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="admins">مديرو الشركة</option>
            <option value="company">جميع موظفي الشركة</option>
            <option value="department">قسم محدد</option>
          </select>
        </label>
        {scope === "department" && (
          <label>
            القسم المسموح
            <select
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">اختر القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="secondary-button" disabled={busy}>
          حفظ صلاحيات المستند
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
function MemberEditor({
  member,
  departments,
  reload,
}: {
  member: Member;
  departments: Department[];
  reload: () => void;
}) {
  const [role, setRole] = useState(member.role),
    [department, setDepartment] = useState(member.department_id || ""),
    [active, setActive] = useState(member.is_active),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      !window.confirm("تحديث صلاحيات هذا العضو؟ يتغير وصوله إلى الوثائق فورًا.")
    )
      return;
    setBusy(true);
    try {
      await api(
        "/members/" + member.id,
        jsonBody(
          { role, department_id: department || null, is_active: active },
          "PATCH",
        ),
      );
      setMessage("حُدّثت العضوية.");
      reload();
    } catch (e) {
      setMessage(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>إدارة العضوية</summary>
      <form className="product-form" onSubmit={save}>
        <label>
          دور العضو
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="new_employee">الموظف الجديد (New Employee)</option>
            <option value="company_admin">مدير الشركة (Company Admin)</option>
          </select>
        </label>
        <label>
          قسم العضو
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">دون قسم</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          عضوية فعّالة
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
        </label>
        <button disabled={busy} className="secondary-button">
          حفظ العضوية
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

function OpenDocument({ id, onClose }: { id: string; onClose: () => void }) {
  const resource = useResource<Document>(
    "/documents/" + encodeURIComponent(id),
  );
  return (
    <>
      <State {...resource} />
      {resource.data && (
        <DocumentReader key={id} document={resource.data} onClose={onClose} />
      )}
    </>
  );
}
