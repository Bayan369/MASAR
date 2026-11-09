import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpLeft,
  BookOpen,
  Check,
  FileText,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { knowledge } from "./knowledge";
import { GatewayMark } from "../design/GatewayMark";
import "./product-journey.css";
import { KnowledgeGateway } from "./KnowledgeGateway";

const stages = ["سؤالك", "المعرفة", "المصدر", "خطوتك"];
const documents = knowledge.filter((doc) =>
  ["onboarding", "leave", "it"].includes(doc.id),
);

/** A real document explorer and a draft handoff, never a simulated AI response. */
export function ProductJourney() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);
  const [question, setQuestion] = useState("");
  const [selected, setSelected] = useState(documents[0]);
  return (
    <section
      className="product-journey"
      aria-labelledby="journey-title"
      data-stage={stage}
      onPointerMove={(event) => {
        if (
          event.pointerType !== "mouse" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        const position = (event.clientX - box.left) / box.width;
        event.currentTarget.dataset.perspective =
          position < 0.4 ? "left" : position > 0.6 ? "right" : "center";
      }}
      onPointerLeave={(event) => {
        delete event.currentTarget.dataset.perspective;
      }}
    >
      <KnowledgeGateway stage={stage} />
      <div className="journey-copy">
        <div className="journey-eyebrow">
          <span aria-hidden="true" /> بوابتك إلى معرفة الشركة
        </div>
        <h2 id="journey-title">
          من أول سؤال،
          <br />
          <em>إلى خطوتك التالية.</em>
        </h2>
        <p>
          معرفة الشركة أقرب إليك. اسأل مسار، اكتشف ما تحتاجه، وتابع بداية رحلتك
          بثقة.
        </p>
        <div className="journey-actions">
          <Link className="journey-primary" to="/assistant">
            جرّب اسأل مسار <ArrowUpLeft size={18} />
          </Link>
          <Link className="journey-secondary" to="/onboarding">
            ابدأ رحلتك <ArrowUpLeft size={16} />
          </Link>
        </div>
        <div className="journey-principles">
          <BookOpen size={16} />
          <span>معرفة الشركة</span>
          <span aria-hidden="true">/</span>
          <span>مصادر قابلة للقراءة</span>
        </div>
      </div>
      <div className="journey-workbench">
        <div className="journey-workbench-heading">
          <span className="journey-mark">
            <GatewayMark />
          </span>
          <div>
            <strong>المعرفة، على مسارك</strong>
            <small>اكتب سؤالًا أو استكشف مستندًا</small>
          </div>
          <span className="journey-wordmark" dir="ltr">
            MASAR
          </span>
        </div>
        <div className="journey-route" aria-hidden="true">
          <svg viewBox="0 0 440 76" fill="none">
            <path d="M10 38H100Q120 38 130 24L142 12Q155 0 170 12L215 63Q227 77 242 63L265 38H430" />
            <circle cx="10" cy="38" r="4" />
            <circle cx="430" cy="38" r="4" />
          </svg>
          <span>
            <Sparkles size={20} />
          </span>
        </div>
        <div
          className="journey-stages"
          role="tablist"
          aria-label="استكشف رحلة المعرفة"
        >
          {stages.map((label, index) => (
            <button
              key={label}
              id={`journey-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={stage === index}
              aria-controls="journey-panel"
              tabIndex={stage === index ? 0 : -1}
              onClick={() => setStage(index)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowLeft"
                    ? (index + 1) % stages.length
                    : event.key === "ArrowRight"
                      ? (index + stages.length - 1) % stages.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? stages.length - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setStage(next);
                  document.getElementById(`journey-tab-${next}`)?.focus();
                }
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {label}
            </button>
          ))}
        </div>
        <div
          className="journey-panel"
          key={stage}
          id="journey-panel"
          role="tabpanel"
          aria-labelledby={`journey-tab-${stage}`}
          tabIndex={0}
        >
          {stage === 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (question.trim())
                  navigate(
                    `/assistant?q=${encodeURIComponent(question.trim())}`,
                  );
              }}
            >
              <label htmlFor="journey-question">
                ما الذي تحتاج معرفته اليوم؟
              </label>
              <p>سؤال بلغتك، وبداية حوار مع مسار.</p>
              <div className="journey-question">
                <input
                  id="journey-question"
                  maxLength={2000}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="اكتب سؤالك هنا…"
                />
                <button
                  aria-label="متابعة السؤال في اسأل مسار"
                  disabled={!question.trim()}
                >
                  <Send size={18} />
                </button>
              </div>
              <small>تابع في «اسأل مسار» لإرسال السؤال والحصول على الرد.</small>
            </form>
          )}
          {stage === 1 && (
            <>
              <h3>
                <Search size={17} /> استكشف المعرفة المتاحة
              </h3>
              <p>اختر مستندًا لقراءة مقتطفه الأصلي.</p>
              <div className="journey-documents">
                {documents.map((doc) => (
                  <button
                    type="button"
                    key={doc.id}
                    onClick={() => {
                      setSelected(doc);
                      setStage(2);
                      requestAnimationFrame(() => {
                        document.getElementById("journey-panel")?.focus();
                      });
                    }}
                  >
                    <FileText size={17} />
                    <span>{doc.title}</span>
                    <ArrowUpLeft size={15} />
                  </button>
                ))}
              </div>
            </>
          )}
          {stage === 2 && (
            <>
              <h3>
                <BookOpen size={17} /> {selected.title}
              </h3>
              <p>مقتطف من المستند المتاح في مكتبة مسار</p>
              <blockquote>{selected.steps[0]}</blockquote>
              <Link to={`/documents/${selected.id}`}>
                اقرأ المستند كاملًا <ArrowUpLeft size={15} />
              </Link>
            </>
          )}
          {stage === 3 && (
            <>
              <h3>
                <Check size={18} /> معرفة تقود إلى خطوة
              </h3>
              <p>من فهم الإجراء إلى متابعة رحلتك. اختر ما يناسبك الآن.</p>
              <div className="journey-next">
                <Link to="/onboarding">
                  افتح دليل البداية <ArrowUpLeft size={16} />
                </Link>
                <Link to="/assistant">
                  تابع بسؤال إلى مسار <Sparkles size={16} />
                </Link>
              </div>
            </>
          )}
        </div>
        <div className="journey-workbench-footer">
          <span>
            <FileText size={13} /> من مكتبة مسار
          </span>
          <Link to="/documents">
            تصفّح المعرفة <ArrowUpLeft size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
