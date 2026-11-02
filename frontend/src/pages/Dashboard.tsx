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
import { EmptyState, Icon, SectionHeading, Term } from "../components/ui";
import { departments } from "../lib/content";
export default function Dashboard() {
  return (
    <div className="dashboard">
      <section className="welcome">
        <div>
          <p className="eyebrow">
            <Sunrise size={16} />
            بداية جديدة، بخطوات واثقة
          </p>
          <h1>
            أهلًا بك، في <span>مسارك.</span>
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
        <SectionHeading
          title={
            <>
              تعرّف على أقسام شركتك <Term>Departments</Term>
            </>
          }
        >
          <Link className="text-link" to="/departments">
            عرض جميع الأقسام
            <ArrowLeft size={15} />
          </Link>
        </SectionHeading>
        <p className="section-description">اعرف دور كل قسم، ومن أين تبدأ.</p>
        <div className="department-shortcuts">
          {departments.slice(0, 4).map((d) => (
            <Link
              key={d.term}
              to={"/departments?department=" + d.term}
              className="department-shortcut"
            >
              <span className={"department-icon " + d.icon}>
                <Icon name={d.icon} size={23} />
              </span>
              <div>
                <h3>{d.name}</h3>
                <bdi dir="ltr">({d.term})</bdi>
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
            استكشف قاعدة المعرفة <Term>Knowledge Base</Term>
            <ArrowUpLeft size={17} />
          </Link>
        </section>
        <section className="recent-card">
          <SectionHeading title="محادثاتك الأخيرة">
            <Icon name="history" size={19} />
          </SectionHeading>
          <EmptyState
            title="كل رحلة تبدأ بسؤال"
            description="لا توجد محادثات محفوظة بعد. عند تفعيل المساعد، ستجد أسئلتك ومراجعها هنا."
          >
            <Link className="text-link" to="/assistant">
              انتقل إلى المساعد الذكي
              <ArrowUpLeft size={15} />
            </Link>
          </EmptyState>
        </section>
      </div>
      <div className="foundation-note">
        <span className="status-dot" />
        <p>
          أنت تستكشف النسخة التأسيسية من مسار. سيتم تفعيل المساعد ومصادر الشركة
          في مرحلة لاحقة.
        </p>
      </div>
    </div>
  );
}
