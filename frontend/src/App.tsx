import Demo from "./demo/Demo";
import { AuthProvider, RequireAuth, useAuth } from "./auth/AuthProvider";
import Recovery from "./pages/Recovery";
import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  Menu,
  X,
  ChevronLeft,
  ArrowUpLeft,
  BookOpen,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { ar } from "./lib/content";
import { Icon } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import {
  Assistant,
  Departments,
  Knowledge,
  History,
  SettingsPage,
  NotFound,
} from "./pages/WorkspacePages";
import Login from "./pages/Login";
function Workspace() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 700px)").matches,
  );
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
    const update = () => {
      setMobile(query.matches);
      setOpen(false);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const sidebar = sidebarRef.current;
    const items = sidebar?.querySelectorAll<HTMLElement>("a,button");
    items?.[0]?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuRef.current?.focus();
      }
      if (event.key === "Tab" && items?.length) {
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, mobile]);

  const location = useLocation();
  const current = ar.navigation.find((n) => n.path === location.pathname);
  return (
    <div className="workspace">
      {open && (
        <button
          aria-label="إغلاق القائمة"
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={mobile && !open}
        role={mobile && open ? "dialog" : undefined}
        aria-modal={mobile && open ? true : undefined}
        aria-label="القائمة الرئيسية"
        className={"sidebar " + (open ? "is-open" : "")}
      >
        <Link className="brand" to="/" aria-label="مسار، الصفحة الرئيسية">
          <span className="brand-mark">
            <Compass size={31} strokeWidth={1.3} />
          </span>
          <span>
            مسار<small>معرفة ترشدك.</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق القائمة"
        >
          <X />
        </button>
        <div className="workspace-label">
          مساحة الموظف<span>{auth.membership?.company.name}</span>
        </div>
        <nav aria-label="التنقل الرئيسي">
          {ar.navigation.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.path === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                "nav-item " + (isActive ? "active" : "")
              }
            >
              <Icon name={n.icon} />
              <span>
                {n.label}
                <small>
                  <bdi dir="ltr">({n.term})</bdi>
                </small>
              </span>
              <ChevronLeft size={15} className="nav-chevron" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-icon">
              <BookOpen size={20} />
            </span>
            <h3>كل معرفة، لها مصدر.</h3>
            <p>
              خطوتك الأولى لفهم شركتك،
              <br />
              بوضوح وثقة.
            </p>
            <Link to="/knowledge">
              استكشف قاعدة المعرفة
              <ArrowUpLeft size={15} />
            </Link>
          </div>
          <Link to="/settings" className="account-link">
            <span className="account-icon">
              <Icon name="hr" size={19} />
            </span>
            <span>
              {auth.membership?.profile.display_name || "حسابك"}
              <small>
                {auth.membership?.profile.role === "company_admin"
                  ? "مدير الشركة"
                  : "الموظف الجديد"}
              </small>
            </span>
            <ChevronLeft size={17} />
          </Link>
        </div>
      </aside>
      <div className="main-shell" inert={mobile && open}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              ref={menuRef}
              className="mobile-menu icon-button"
              aria-label="فتح القائمة"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span>مساحة العمل</span>
            <ChevronLeft size={13} />
            <strong>{current?.label || "الصفحة"}</strong>
          </div>
          <div className="topbar-end">
            <span className="phase-indicator">
              <i />
              مساحة الشركة
            </span>
            <span className="topbar-divider" />
            <button
              className="header-login icon-button"
              onClick={() => void auth.logout()}
            >
              تسجيل الخروج
              <ArrowUpLeft size={15} />
            </button>
          </div>
        </header>
        <main id="main-content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/assistant" element={<Assistant />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/knowledge" element={<Knowledge />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer className="footer">
          <span>
            مسار © {new Date().getFullYear()}
            <span className="footer-dot">·</span>معرفة مؤسسية. بخطوات أوضح.
          </span>
          <span>
            <ShieldCheck size={14} />
            مصادر معتمدة، معرفة موثوقة
          </span>
        </footer>
      </div>
    </div>
  );
}
function AuthenticatedApp() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        انتقل إلى المحتوى
      </a>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<Recovery />} />
          <Route
            path="*"
            element={
              <RequireAuth>
                <Workspace />
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/demo" replace />} />
      <Route path="/demo/*" element={<Demo />} />
      <Route path="*" element={<AuthenticatedApp />} />
    </Routes>
  );
}
