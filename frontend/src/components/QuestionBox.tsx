import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpLeft, Sparkles, LockKeyhole } from "lucide-react";
import { ar } from "../lib/content";
import { Link } from "react-router-dom";
import { askAssistant, type AssistantAnswer } from "../lib/assistant";
export default function QuestionBox({ full = false }: { full?: boolean }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const conversationId = useRef(params.get("conversation") || undefined);
  const retry = useRef<{ question: string; id: string } | null>(null);
  const [question, setQuestion] = useState(params.get("q") || "");
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) {
      setMessage("اكتب سؤالك أولًا، أو اختر أحد الأسئلة المقترحة.");
      return;
    }
    if (!full) {
      navigate("/assistant?q=" + encodeURIComponent(question.trim()));
      return;
    }
    if (loading) return;
    setMessage("");
    setAnswer(null);
    setLoading(true);
    const controller = new AbortController();
    active.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 180000);
    try {
      if (!retry.current || retry.current.question !== question.trim())
        retry.current = { question: question.trim(), id: crypto.randomUUID() };
      const result = await askAssistant(
        question.trim(),
        controller.signal,
        conversationId.current,
        retry.current.id,
      );
      conversationId.current = result.conversation_id;
      retry.current = null;
      setAnswer(result);
    } catch (error) {
      if (active.current === controller) {
        setMessage(
          error instanceof Error && error.name !== "AbortError"
            ? error.message
            : "انتهت مهلة السؤال. تحقق من الخدمة قبل إعادة المحاولة.",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (active.current === controller) {
        setLoading(false);
        active.current = null;
      }
    }
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
            disabled={loading}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              setMessage("");
            }}
            placeholder="ما الذي تود معرفته اليوم؟"
          />
          <button className="ask-button" type="submit" disabled={loading}>
            {loading
              ? "جارٍ البحث وصياغة الإجابة…"
              : full
                ? "إرسال السؤال"
                : "اسأل مسار"}
            <ArrowUpLeft size={19} />
          </button>
        </div>
      </form>
      <div className="suggestion-label">أو ابدأ بسؤال شائع</div>
      <div className="suggestions">
        {ar.questions.slice(0, full ? 5 : 3).map((q) => (
          <button
            key={q}
            disabled={loading}
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
        <span>الإجابات تستند إلى مستندات شركتك مع الإشارة إلى مصادرها.</span>
      </div>
      {loading && (
        <p className="inline-notice" role="status">
          جارٍ استرجاع المقاطع وطلب الإجابة من Llama…
        </p>
      )}
      {answer && (
        <section
          className="assistant-answer"
          aria-label="إجابة مسار"
          aria-live="polite"
        >
          <div className="answer-label">
            {answer.status === "answered"
              ? "إجابة من وثائق شركتك"
              : "المعلومة غير متوفرة"}
          </div>
          <p className="answer-text" dir="auto">
            {answer.answer}
          </p>
          {answer.sources.length > 0 && (
            <div className="answer-sources">
              <h3>المصادر المستخدمة</h3>
              {answer.sources.map((source) => (
                <article key={source.id}>
                  <Link
                    to={
                      "/knowledge?document=" +
                      encodeURIComponent(source.document_id)
                    }
                  >
                    {source.title}
                    <ArrowUpLeft size={14} />
                  </Link>
                  <small>{source.section}</small>
                  <blockquote dir="auto">{source.quote}</blockquote>
                  <details>
                    <summary>عرض المقطع الأصلي</summary>
                    <p dir="auto">{source.excerpt}</p>
                  </details>
                </article>
              ))}
            </div>
          )}
          {answer.generated_by && (
            <small className="answer-provider">
              إجابة مولّدة بواسطة Llama عبر Cloudflare Workers AI. راجع المصادر
              قبل اتخاذ قرار.
            </small>
          )}
        </section>
      )}
      {message && (
        <p className="inline-notice" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
