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
import { askLlama, liveDemo } from "./llama";
import { demoSourceHref } from "./endpoints";
import { PageHeader } from "../design/Primitives";
import { GatewayMark } from "../design/GatewayMark";
import { usePageMotion } from "../design/usePageMotion";
import "./demo.css";
import "./studio.css";
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
  const [chatError, setChatError] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const main = useRef<HTMLElement>(null);
  usePageMotion(main, location.pathname);
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
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || typing) return;
    setChatError(null);
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
    try {
      const result = liveDemo
        ? await askLlama(
            text,
            chat.context,
            chat.messages.map((message) => ({
              role: message.role,
              content: message.text,
            })),
          )
        : respond(text, chat.context);
      if (!liveDemo)
        await new Promise<void>((resolve) => {
          timer.current = setTimeout(resolve, 450);
        });
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
    } catch (error) {
      setChatError({
        id: selected,
        message:
          error instanceof Error ? error.message : "تعذّر الاتصال بخدمة Llama.",
      });
    } finally {
      setTyping(false);
      messageInput.current?.focus();
    }
  }
  return (
    <div
      className={`demo-shell masar-studio ${assistantPage ? "assistant-workspace" : ""}`}
      dir="rtl"
    >
      <a className="skip-link" href="#main-content">
        انتقل إلى المحتوى
      </a>
      <header className="masar-navbar">
        <Link className="masar-brand" to="/" aria-label="مسار — الرئيسية">
          <GatewayMark />
          <span>
            مسار<small>بوابتك إلى المعرفة</small>
          </span>
        </Link>
        <button
          ref={menuButton}
          className="masar-menu-button"
          aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={menuOpen}
          aria-controls="platform-sidebar"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav
          id="platform-sidebar"
          className={`masar-nav-links ${menuOpen ? "is-open" : ""}`}
          aria-label="التنقل الرئيسي"
        >
          {[0, 1, 4, 2, 5].map((index) => {
            const item = demoNavigation[index];
            const Icon = icons[index];
            const label =
              index === 4
                ? "قاعدة المعرفة"
                : index === 2
                  ? "المهام"
                  : item.label;
            return (
              <NavLink key={item.path} to={item.path} end={item.path === "/"}>
                <Icon size={17} />
                <span>{label}</span>
                <i aria-hidden="true" />
              </NavLink>
            );
          })}
          <Link className="masar-mobile-procedures" to="/policies">
            السياسات والإجراءات <ArrowUpLeft size={15} />
          </Link>
        </nav>
        <NavLink className="masar-nav-utility" to="/policies">
          <BookOpen size={16} />
          <span>الإجراءات</span>
          <ArrowUpLeft size={14} />
        </NavLink>
      </header>
      <div className="platform-body">
        <main
          ref={main}
          id="main-content"
          className={`demo-main ${assistantPage ? "is-assistant" : ""}`}
          data-page={currentPage?.path}
        >
          <PageHeader
            title={currentPage?.label || "الصفحة غير موجودة"}
            eyebrow={assistantPage ? "معرفة تبدأ بسؤال" : "مساحة عملك، بوضوح"}
            headingRef={heading}
            index={
              currentPage
                ? String(demoNavigation.indexOf(currentPage) + 1).padStart(
                    2,
                    "0",
                  )
                : undefined
            }
          >
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
          </PageHeader>
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
                      <GatewayMark />
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
                        "كيف أتصل بالشبكة الخاصة (VPN)؟",
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
                        <details key={`${s.title}-${s.quote}`}>
                          <summary>
                            <BookOpen size={14} />
                            المصدر: {s.title}
                            {s.section ? ` — ${s.section}` : ""}
                          </summary>
                          <blockquote>{s.quote}</blockquote>
                          {demoSourceHref(s.url) && (
                            <a
                              className="platform-source"
                              href={demoSourceHref(s.url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              افتح المستند الأصلي
                              <ArrowUpLeft size={14} />
                            </a>
                          )}
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
                    <span>
                      مسار يعالج سؤالك…
                      <small className="ai-loading-caption">
                        ستظهر الإجابة هنا عند اكتمال المعالجة
                      </small>
                    </span>
                  </p>
                )}
                {chatError?.id === selected && (
                  <p role="alert">{chatError.message}</p>
                )}
                <div ref={bottom} />
              </section>
              <form className="demo-composer" onSubmit={send}>
                <label className="sr-only" htmlFor="demo-message">
                  رسالتك للمساعد
                </label>
                <div>
                  <span className="platform-composer-symbol" aria-hidden="true">
                    <Sparkles size={20} />
                  </span>
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
