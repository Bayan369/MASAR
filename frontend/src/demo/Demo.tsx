import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { demoNavigation, departments } from "./catalog";
import {
  Home,
  DepartmentsPage,
  DepartmentDetail,
  PoliciesPage,
  Procedure,
  DocumentsPage,
  DocumentDetail,
  Missing,
} from "./PlatformPages";
import { Compass, Send, Plus, BookOpen, MessageSquare } from "lucide-react";
import {
  knowledge,
  respond,
  statusLabels,
  type Context,
  type Reply,
} from "./knowledge";
import "./demo.css";
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; reply: Reply };
type Chat = {
  id: number;
  title: string;
  messages: Message[];
  context: Context;
};
const fresh = (id: number): Chat => ({
  id,
  title: "محادثة جديدة",
  messages: [],
  context: { step: 0 },
});
export default function Demo() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const proposedQuestion = params.get("q") || "";
  const assistantPage =
    location.pathname.replace(/\/$/, "") === "/demo/assistant";
  const currentPage =
    demoNavigation.find((n) => n.path === location.pathname) ||
    demoNavigation.find(
      (n) => n.path !== "/demo" && location.pathname.startsWith(n.path + "/"),
    );
  useEffect(() => {
    if (assistantPage && proposedQuestion) setInput(proposedQuestion);
  }, [assistantPage, proposedQuestion]);
  const [chats, setChats] = useState<Chat[]>([fresh(1)]);
  const [selected, setSelected] = useState(1);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const chat = chats.find((c) => c.id === selected)!;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [chat.messages.length, typing, selected]);
  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    const result = respond(text, chat.context);
    setChats((items) =>
      items.map((c) =>
        c.id === selected
          ? {
              ...c,
              title: c.messages.length ? c.title : text.slice(0, 48),
              messages: [...c.messages, { role: "user", text }],
            }
          : c,
      ),
    );
    setInput("");
    setTyping(true);
    // A short presentation delay, not remote inference or a claimed AI response.
    timer.current = setTimeout(() => {
      setChats((items) =>
        items.map((c) =>
          c.id === selected
            ? {
                ...c,
                context: result.context,
                messages: [
                  ...c.messages,
                  { role: "assistant", text: result.text, reply: result },
                ],
              }
            : c,
        ),
      );
      setTyping(false);
    }, 450);
  }
  return (
    <div className="demo-shell" dir="rtl">
      <aside
        className="demo-sidebar"
        aria-label="التنقل في منصة مسار التجريبية"
      >
        <Link to="/demo" className="brand">
          <Compass />
          <span>
            مسار<small>تجربة الموظف الجديد</small>
          </span>
        </Link>
        <span className="demo-pill">بيانات تجريبية فقط (Mock Data)</span>
        <nav aria-label="التنقل الرئيسي">
          {demoNavigation.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === "/demo"}>
              <BookOpen size={17} />
              <span>
                {n.label}
                <small dir="ltr">{n.term}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="demo-chat-history" hidden={!assistantPage}>
          <button
            className="demo-new"
            disabled={typing}
            onClick={() => {
              const id = Math.max(...chats.map((c) => c.id)) + 1;
              setChats((items) => [...items, fresh(id)]);
              setSelected(id);
              setInput("");
              navigate("/demo/assistant");
            }}
          >
            <Plus size={18} />
            محادثة جديدة
          </button>
          <h2>المحادثات في هذه الجلسة</h2>
          <nav aria-label="المحادثات في هذه الجلسة">
            {chats.map((c) => (
              <button
                key={c.id}
                disabled={typing}
                aria-current={selected === c.id ? "page" : undefined}
                onClick={() => {
                  setSelected(c.id);
                  setInput("");
                }}
              >
                <MessageSquare size={16} />
                <span dir="auto">{c.title}</span>
              </button>
            ))}
          </nav>
        </div>
        <p>
          السجل محلي في الذاكرة ويُمسح عند تحديث الصفحة. لا تدخل معلومات شخصية
          أو أسرارًا.
        </p>
        <span>نسخة عرض الموظف الجديد · دون حساب أو تسجيل دخول</span>
      </aside>
      <main id="main-content" className="demo-main">
        <header>
          <div>
            <span className="eyebrow">مساحة آمنة للاستكشاف</span>
            <h1>
              {currentPage ? (
                <>
                  {currentPage.label} <bdi>({currentPage.term})</bdi>
                </>
              ) : (
                "الصفحة غير موجودة"
              )}
            </h1>
          </div>
          <BookOpen aria-hidden="true" />
        </header>
        <div className="demo-disclaimer">
          هذه شركة وسياسات تجريبية، وليست معلومات شركتك الحقيقية. يعمل الديمو
          محليًا بقواعد محادثة وبيانات ثابتة؛ لا يستخدم Llama أو Supabase أو أي
          خدمة خارجية.
        </div>
        <Routes>
          <Route index element={<Home />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="departments/:id" element={<DepartmentDetail />} />
          <Route path="onboarding" element={<Procedure onboarding />} />
          <Route path="policies" element={<PoliciesPage />} />
          <Route path="policies/:id" element={<Procedure />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:id" element={<DocumentDetail />} />
          <Route path="assistant" element={null} />
          <Route path="*" element={<Missing />} />
        </Routes>
        <div hidden={!assistantPage}>
          <section
            className="demo-messages"
            role="log"
            aria-label="رسائل المحادثة"
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={typing}
          >
            {!chat.messages.length && (
              <div className="demo-welcome">
                <Compass size={40} />
                <h2>أول خطوة، بسؤال.</h2>
                <p>
                  اسأل عن يومك الأول، ثم تابع بـ «طيب وبعدها؟» أو «وش تقصد؟».
                </p>
                <div className="suggestions">
                  {[
                    "كيف أبدأ أول يوم؟",
                    "كيف أطلب إجازة؟",
                    "How do I connect to VPN?",
                  ].map((q) => (
                    <button key={q} onClick={() => setInput(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.messages.map((m, i) => (
              <article key={i} className={`demo-message ${m.role}`}>
                <strong>
                  {m.role === "user" ? "أنت" : "مسار · مساعد تجريبي"}
                </strong>
                {m.role === "assistant" && (
                  <span className={`demo-status ${m.reply.status}`}>
                    {statusLabels[m.reply.status]}
                  </span>
                )}
                <p dir="auto">{m.text}</p>
                {m.role === "assistant" &&
                  m.reply.sources.map((s) => (
                    <details key={s.title}>
                      <summary>المصدر التجريبي: {s.title}</summary>
                      <blockquote>{s.quote}</blockquote>
                      {s.documentId && (
                        <Link
                          className="platform-source"
                          to={`/demo/documents/${s.documentId}`}
                        >
                          افتح المستند الأصلي ←
                        </Link>
                      )}
                    </details>
                  ))}
                {m.role === "assistant" && (
                  <div className="demo-department-links">
                    {departments
                      .filter(
                        (d) =>
                          m.text.includes(d.name) ||
                          m.reply.sources.some(
                            (s) => s.documentId === `department-${d.id}`,
                          ),
                      )
                      .map((d) => (
                        <Link key={d.id} to={`/demo/departments/${d.id}`}>
                          {m.reply.status === "unavailable"
                            ? "اقتراح غير مؤكد · "
                            : "تعرف على "}
                          قسم {d.name} ({d.term}) ←
                        </Link>
                      ))}
                  </div>
                )}
              </article>
            ))}
            {typing && (
              <p role="status" className="demo-typing">
                مسار يكتب ردًا تجريبيًا<span aria-hidden="true">…</span>
              </p>
            )}
            <div ref={bottom} />
          </section>
          <form className="demo-composer" onSubmit={send}>
            <label htmlFor="demo-message">رسالتك للمساعد التجريبي</label>
            <div>
              <input
                id="demo-message"
                dir="auto"
                maxLength={2000}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اكتب سؤالك أو تابع المحادثة…"
                disabled={typing}
              />
              <button disabled={typing || !input.trim()} type="submit">
                <Send size={18} />
                إرسال
              </button>
            </div>
          </form>
          <details className="demo-knowledge">
            <summary>استكشف قاعدة المعرفة التجريبية (Knowledge Base)</summary>
            {knowledge.map((d) => (
              <article key={d.id}>
                <h3>{d.title}</h3>
                {d.steps.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </article>
            ))}
          </details>
        </div>
      </main>
    </div>
  );
}
