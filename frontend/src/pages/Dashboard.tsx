import { Link } from "react-router-dom";
import {
  ArrowUpLeft,
  ArrowLeft,
  BookOpen,
  FileText,
  ShieldCheck,
  Sunrise,
  Compass,
} from "lucide-react";
import QuestionBox from "../components/QuestionBox";
import { EmptyState, Icon, SectionHeading } from "../components/ui";
import {
  useResource,
  type Department,
  type Conversation,
} from "../lib/product";
import { useAuth } from "../auth/AuthProvider";
export default function Dashboard() {
  const { membership } = useAuth();
  const departments = useResource<Department[]>("/departments");
  const recent = useResource<Conversation[]>("/conversations");
  return (
    <div className="dashboard">
      <section className="welcome">
        <div>
          <p className="eyebrow">
            <Sunrise size={16} />
            بداية جديدة، بخطوات واثقة
          </p>
          <h1>
            أهلًا {membership?.profile.display_name || "بك"}، في{" "}
            <span>مسارك.</span>
          </h1>
          <p>
            كل ما تحتاج لمعرفته عن شركتك، أقرب إليك.
            <br className="mobile-only" /> لنبدأ من سؤالك الأول.
          </p>
        </div>
        <div className="welcome-seal">
          <Compass size={32} strokeWidth={1.1} />
          <span>
            وجهتك الأولى
            <br />
            <strong>لمعرفة شركتك</strong>
          </span>
        </div>
      </section>
      <div className="hero-grid">
        <QuestionBox />
        <aside className="guide-card">
          <div className="guide-label">
            <span />
            دليلك في مسار
          </div>
          <h2>
            معرفة واضحة.
            <br />
            بداية مطمئنة.
          </h2>
          <p>تعرّف على طريقة الوصول للمعلومة الصحيحة، في الوقت المناسب.</p>
          <div className="guide-steps">
            <div>
              <span>٠١</span>
              <p>
                <strong>اسأل بطريقتك</strong>
                <small>بالعربية أو الإنجليزية، وبمصطلحاتك المعتادة.</small>
              </p>
            </div>
            <div>
              <span>٠٢</span>
              <p>
                <strong>افهم من المصدر</strong>
                <small>إجابات مرتبطة بالوثائق والسياسات المعتمدة.</small>
              </p>
            </div>
            <div>
              <span>٠٣</span>
              <p>
                <strong>خذ خطوتك التالية</strong>
                <small>اعرف الإجراء والقسم المناسب لمساعدتك.</small>
              </p>
            </div>
          </div>
          <div className="guide-foot">
            <ShieldCheck size={16} />
            مصمم لخصوصية المعرفة المؤسسية
          </div>
        </aside>
      </div>
      <section className="departments-section">
        <SectionHeading title={<>تعرّف على أقسام شركتك</>}>
          <Link className="text-link" to="/departments">
            عرض جميع الأقسام
            <ArrowLeft size={15} />
          </Link>
        </SectionHeading>
        <p className="section-description">اعرف دور كل قسم، ومن أين تبدأ.</p>
        {departments.loading && <p role="status">جارٍ تحميل الأقسام…</p>}
        {departments.error && (
          <p role="alert">
            {departments.error}
            <button onClick={departments.reload}>إعادة المحاولة</button>
          </p>
        )}
        {departments.data?.length === 0 && (
          <p className="notice">لم تُضف أقسام إلى الشركة بعد.</p>
        )}
        <div className="department-shortcuts">
          {departments.data?.slice(0, 4).map((d) => (
            <Link
              key={d.id}
              to={"/departments?department=" + d.id}
              className="department-shortcut"
            >
              <span className="department-icon">
                <BookOpen size={23} />
              </span>
              <div>
                <h3>{d.name}</h3>
                <small>{d.description || "قسم الشركة"}</small>
              </div>
              <ArrowUpLeft size={17} />
            </Link>
          ))}
        </div>
      </section>
      <div className="bottom-grid">
        <section className="knowledge-card">
          <div className="card-kicker">
            <BookOpen size={19} />
            مرجعك في كل خطوة
          </div>
          <h2>
            المعلومة الصحيحة،
            <br />
            من مكانها الصحيح.
          </h2>
          <p>
            سياسات الشركة وإجراءاتها وأدلتها الداخلية،
            <br />
            في قاعدة معرفة واحدة.
          </p>
          <div className="document-tags">
            <span>
              <FileText size={13} />
              السياسات
            </span>
            <span>
              <FileText size={13} />
              الإجراءات
            </span>
            <span>
              <FileText size={13} />
              الأدلة
            </span>
          </div>
          <Link className="secondary-button" to="/knowledge">
            استكشف قاعدة المعرفة
            <ArrowUpLeft size={17} />
          </Link>
        </section>
        <section className="recent-card">
          <SectionHeading title="محادثاتك الأخيرة">
            <Icon name="history" size={19} />
          </SectionHeading>
          {recent.loading && <p role="status">جارٍ تحميل المحادثات…</p>}
          {recent.error && (
            <p role="alert">
              {recent.error}
              <button onClick={recent.reload}>إعادة المحاولة</button>
            </p>
          )}
          {recent.data?.slice(0, 3).map((c) => (
            <Link
              className="history-row"
              key={c.id}
              to={"/assistant?conversation=" + c.id}
            >
              {c.title || "محادثة"}
              <ArrowUpLeft size={16} />
            </Link>
          ))}
          {recent.data?.length === 0 && (
            <EmptyState
              title="كل رحلة تبدأ بسؤال"
              description="لا توجد محادثات حتى الآن. ابدأ بسؤال وستجد محادثاتك الخاصة هنا."
            >
              <Link className="text-link" to="/assistant">
                انتقل إلى المساعد الذكي
                <ArrowUpLeft size={15} />
              </Link>
            </EmptyState>
          )}
        </section>
      </div>
      <div className="foundation-note">
        <span className="status-dot" />
        <p>
          معرفة مؤسسية خاصة: تظهر لك الوثائق والمحادثات المسموح بها لحسابك فقط.
        </p>
      </div>
    </div>
  );
}
