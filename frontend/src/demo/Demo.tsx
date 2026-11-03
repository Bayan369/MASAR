import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import {
  Compass,
  Send,
  Plus,
  BookOpen,
  MessageSquare,
  Home as HomeIcon,
  Building2,
  Route as RouteIcon,
  Files,
  Sparkles,
  Menu,
  X,
  ChevronLeft,
  ArrowUpLeft,
} from "lucide-react";
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
import { respond, statusLabels, type Context, type Reply } from "./knowledge";
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
const icons = [HomeIcon, Building2, RouteIcon, BookOpen, Files, Sparkles];
export default function Demo() {
  const location = useLocation();
  const [params] = useSearchParams();
  const proposedQuestion = params.get("q") || "";
  const assistantPage = location.pathname.replace(/\/$/, "") === "/assistant";
  const currentPage =
    demoNavigation.find((n) => n.path === location.pathname) ||
    demoNavigation.find(
      (n) => n.path !== "/" && location.pathname.startsWith(n.path + "/"),
    );
  const [menuOpen, setMenuOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([fresh(1)]);
  const [selected, setSelected] = useState(1);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const chat = chats.find((c) => c.id === selected)!;
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (assistantPage && proposedQuestion) setInput(proposedQuestion);
  }, [assistantPage, proposedQuestion]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const messages = bottom.current?.parentElement;
    if (messages)
      messages.scrollTop = chat.messages.length ? messages.scrollHeight : 0;
  }, [chat.messages.length, typing, selected, assistantPage]);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      setMenuOpen(false);
      heading.current?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    document.title = `${currentPage?.label || "الصفحة"} | مسار MASAR`;
  }, [location.pathname, currentPage?.label]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);
  function newChat() {
    const id = Math.max(...chats.map((c) => c.id)) + 1;
    setChats((items) => [...items, fresh(id)]);
    setSelected(id);
    setInput("");
    messageInput.current?.focus();
  }
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
      messageInput.current?.focus();
    }, 450);
  }
  return (
    <div
      className={`demo-shell ${assistantPage ? "assistant-workspace" : ""}`}
      dir="rtl"
    >
      <a className="skip-link" href="#main-content">
        انتقل إلى المحتوى
      </a>
      <div
        className="platform-mobile-bar"
        role="navigation"
        aria-label="أدوات التنقل"
      >
        <Link className="brand" to="/">
          <Compass size={25} />
          <span>مسار</span>
        </Link>
        <button
          ref={menuButton}
          className="platform-icon-button"
          aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={menuOpen}
          aria-controls="platform-sidebar"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
      <aside
        id="platform-sidebar"
        className={`demo-sidebar ${menuOpen ? "is-open" : ""}`}
        aria-label="التنقل في منصة مسار"
      >
        <Link className="brand" to="/">
          <span className="platform-brand-symbol">
            <Compass size={29} strokeWidth={1.5} />
          </span>
          <span>
            مسار<small>معرفة ترشدك.</small>
          </span>
        </Link>
        <div className="platform-workspace-label">
          <span className="platform-company-symbol">
            <Building2 size={18} />
          </span>
          <div>
            مساحة الموظف<small>شركة مسار</small>
          </div>
        </div>
        <span className="platform-nav-caption">مساحة المعرفة</span>
        <nav aria-label="التنقل الرئيسي">
          {demoNavigation.map((n, i) => {
            const Icon = icons[i];
            return (
              <NavLink key={n.path} to={n.path} end={n.path === "/"}>
                <Icon size={19} />
                <span>
                  {n.label}
                  <small dir="ltr">{n.term}</small>
                </span>
                <ChevronLeft size={14} className="platform-nav-chevron" />
              </NavLink>
            );
          })}
        </nav>
        <div className="platform-sidebar-bottom">
          <BookOpen size={23} />
          <h2>كل معرفة، لها مصدر.</h2>
          <p>دليل واضح لأقسامك وإجراءاتك، ومساعد يرافق خطواتك.</p>
          <Link to="/documents">
            استكشف المستندات
            <ArrowUpLeft size={15} />
          </Link>
        </div>
        <div className="platform-sidebar-footer">
          <span>MASAR</span>
          <span>مساحة الموظف الجديد</span>
        </div>
      </aside>
      <div className="platform-body">
        <header className="platform-topbar">
          <div className="platform-breadcrumb">
            <Link to="/">مساحة العمل</Link>
            <ChevronLeft size={13} />
            <span>{currentPage?.label || "الصفحة"}</span>
          </div>
          <Link className="platform-topbar-action" to="/assistant">
            <Sparkles size={15} />
            اسأل مسار
            <ArrowUpLeft size={14} />
          </Link>
        </header>
        <main
          id="main-content"
          className={`demo-main ${assistantPage ? "is-assistant" : ""}`}
        >
          <div className="platform-page-heading">
            <div>
              <span className="platform-eyebrow">
                {currentPage?.term || "MASAR"}
              </span>
              <h1 ref={heading} tabIndex={-1}>
                {currentPage?.label || "الصفحة غير موجودة"}
              </h1>
            </div>
            {currentPage?.path === "/" ? (
              <Link className="platform-text-link" to="/onboarding">
                دليلك لليوم الأول
                <ArrowUpLeft size={16} />
              </Link>
            ) : (
              <Link className="platform-text-link" to="/">
                الرئيسية
                <ChevronLeft size={15} />
              </Link>
            )}
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
          <div className="platform-chat" hidden={!assistantPage}>
            <aside className="demo-chat-history" aria-label="سجل المحادثات">
              <button className="demo-new" disabled={typing} onClick={newChat}>
                <Plus size={17} />
                محادثة جديدة
              </button>
              <span className="platform-nav-caption">محادثاتك</span>
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
            </aside>
            <div className="platform-chat-content">
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
                    <span className="platform-welcome-icon">
                      <Sparkles size={30} />
                    </span>
                    <span className="platform-eyebrow">
                      خطوتك التالية تبدأ هنا
                    </span>
                    <h2>كيف أقدر أساعدك اليوم؟</h2>
                    <p>
                      من يومك الأول إلى معرفة القسم المناسب.
                      <br />
                      اسأل مسار، ثم تابع الحوار على راحتك.
                    </p>
                    <div className="platform-chat-suggestions">
                      {[
                        "كيف أبدأ أول يوم؟",
                        "كيف أطلب إجازة؟",
                        "How do I connect to VPN?",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => {
                            setInput(q);
                            messageInput.current?.focus();
                          }}
                        >
                          <span dir="auto">{q}</span>
                          <ArrowUpLeft size={16} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chat.messages.map((m, i) => (
                  <article key={i} className={`demo-message ${m.role}`}>
                    <div className="demo-message-heading">
                      <span className="demo-message-avatar">
                        {m.role === "user" ? "أ" : <Sparkles size={16} />}
                      </span>
                      <strong>{m.role === "user" ? "أنت" : "مسار"}</strong>
                      {m.role === "assistant" && (
                        <span className={`demo-status ${m.reply.status}`}>
                          {statusLabels[m.reply.status]}
                        </span>
                      )}
                    </div>
                    <p dir="auto">{m.text}</p>
                    {m.role === "assistant" &&
                      m.reply.sources.map((s) => (
                        <details key={s.title}>
                          <summary>
                            <BookOpen size={14} />
                            المصدر: {s.title}
                          </summary>
                          <blockquote>{s.quote}</blockquote>
                          {s.documentId && (
                            <Link
                              className="platform-source"
                              to={`/documents/${s.documentId}`}
                            >
                              افتح المستند الأصلي
                              <ArrowUpLeft size={14} />
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
                            <Link key={d.id} to={`/departments/${d.id}`}>
                              {m.reply.status === "unavailable"
                                ? "اقتراح غير مؤكد · "
                                : "تعرف على "}
                              قسم {d.name} ({d.term})<ArrowUpLeft size={13} />
                            </Link>
                          ))}
                      </div>
                    )}
                  </article>
                ))}
                {typing && (
                  <p role="status" className="demo-typing">
                    <span className="platform-typing-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    مسار يكتب…
                  </p>
                )}
                <div ref={bottom} />
              </section>
              <form className="demo-composer" onSubmit={send}>
                <label className="sr-only" htmlFor="demo-message">
                  رسالتك للمساعد
                </label>
                <div>
                  <textarea
                    ref={messageInput}
                    id="demo-message"
                    dir="auto"
                    rows={2}
                    maxLength={2000}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        !e.nativeEvent.isComposing
                      ) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                    placeholder="اكتب سؤالك، أو تابع المحادثة…"
                    disabled={typing}
                  />
                  <button
                    disabled={typing || !input.trim()}
                    type="submit"
                    aria-label="إرسال"
                  >
                    <Send size={19} />
                    <span>إرسال</span>
                  </button>
                </div>
                <div className="platform-composer-hint">
                  <span>Enter للإرسال · Shift + Enter لسطر جديد</span>
                  <Link to="/documents">
                    تصفّح المصادر
                    <BookOpen size={13} />
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </main>
        <footer className="platform-footer">
          <span>
            مسار <bdi>MASAR</bdi>
          </span>
          <span>معرفة مؤسسية. بخطوات أوضح.</span>
        </footer>
      </div>
    </div>
  );
}
