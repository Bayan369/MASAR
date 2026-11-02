import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpLeft, Sparkles, LockKeyhole } from "lucide-react";
import { ar } from "../lib/content";
export default function QuestionBox({ full = false }: { full?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [question, setQuestion] = useState(params.get("q") || "");
  const [message, setMessage] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) {
      setMessage("اكتب سؤالك أولًا، أو اختر أحد الأسئلة المقترحة.");
      return;
    }
    if (!full) {
      navigate("/assistant?q=" + encodeURIComponent(question.trim()));
      return;
    }
    setMessage(
      "المساعد غير متصل بمصادر الشركة بعد. لن نولّد إجابة قبل تفعيل الخدمة وربط المستندات المعتمدة.",
    );
  }
  return (
    <section
      className={"question-card " + (full ? "full-question" : "")}
      aria-labelledby="ask-title"
    >
      <div className="question-top">
        <span className="assistant-symbol">
          <Sparkles size={23} />
        </span>
        <span className="badge">
          <span />
          معرفة موثوقة، بداية أوضح
        </span>
      </div>
      <h2 id="ask-title">سؤالك هو بداية المسار.</h2>
      <p>
        من أول يوم، إلى كل خطوة تالية. اسأل عن سياسات شركتك وإجراءاتها في مكان
        واحد.
      </p>
      <form onSubmit={submit}>
        <label className="sr-only" htmlFor="question">
          سؤالك للمساعد الذكي
        </label>
        <div className="question-input">
          <input
            id="question"
            dir="auto"
            maxLength={2000}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setMessage("");
            }}
            placeholder="ما الذي تود معرفته اليوم؟"
          />
          <button className="ask-button" type="submit">
            {full ? "إرسال السؤال" : "اسأل مسار"}
            <ArrowUpLeft size={19} />
          </button>
        </div>
      </form>
      <div className="suggestion-label">أو ابدأ بسؤال شائع</div>
      <div className="suggestions">
        {ar.questions.slice(0, full ? 5 : 3).map((q) => (
          <button
            key={q}
            onClick={() => {
              setQuestion(q);
              setMessage("");
            }}
          >
            {q}
            <ArrowUpLeft size={13} />
          </button>
        ))}
      </div>
      <div className="source-note">
        <LockKeyhole size={13} />
        <span>الإجابات ستستند إلى مستندات شركتك مع الإشارة إلى مصادرها.</span>
      </div>
      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
