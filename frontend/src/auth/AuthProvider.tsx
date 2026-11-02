import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { getSupabaseClient } from "../lib/supabase";
import { api } from "../lib/api";
export interface Membership {
  profile: {
    id: string;
    company_id: string;
    display_name: string | null;
    department_id: string | null;
    role: "company_admin" | "new_employee";
  };
  company: { id: string; name: string };
}
interface Auth {
  session: Session | null;
  membership: Membership | null;
  loading: boolean;
  error: string;
  reload: () => void;
  logout: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false),
    [session, setSession] = useState<Session | null>(null),
    [membership, setMembership] = useState<Membership | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      const client = getSupabaseClient();
      client.auth
        .getSession()
        .then(({ data, error }) => {
          if (active) {
            setSession(data.session);
            if (error) setError("انتهت الجلسة. سجّل الدخول مجددًا.");
            setLoading(false);
            setInitialized(true);
          }
        })
        .catch(() => {
          if (active) {
            setError("تعذّر استعادة الجلسة.");
            setLoading(false);
            setInitialized(true);
          }
        });
      const subscription = client.auth.onAuthStateChange((_event, value) => {
        if (active) {
          setSession(value);
          if (!value) setMembership(null);
        }
      });
      unsubscribe = () => subscription.data.subscription.unsubscribe();
      const expire = () => {
        void client.auth.signOut({ scope: "local" });
      };
      window.addEventListener("masar-session-expired", expire);
      const previous = unsubscribe;
      unsubscribe = () => {
        previous();
        window.removeEventListener("masar-session-expired", expire);
      };
    } catch {
      setError(
        "إعدادات تسجيل الدخول غير مكتملة. يلزم إعداد Supabase في الواجهة والخادم.",
      );
      setLoading(false);
      setInitialized(true);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!session) {
      setMembership(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    api<Membership>("/me")
      .then((data) => {
        if (active) setMembership(data);
      })
      .catch((e) => {
        if (active) {
          setMembership(null);
          setError(e instanceof Error ? e.message : "تعذّر تحميل حسابك.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, attempt, initialized]);
  async function logout() {
    try {
      await getSupabaseClient().auth.signOut();
    } catch {
      /* Clear this browser's session even when remote logout is unavailable. */
    } finally {
      try {
        await getSupabaseClient().auth.signOut({ scope: "local" });
      } finally {
        setSession(null);
        setMembership(null);
        setLoading(false);
      }
    }
  }
  return (
    <Context.Provider
      value={{
        session,
        membership,
        loading: !initialized || loading,
        error,
        reload: () => setAttempt((n) => n + 1),
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("AuthProvider required");
  return value;
}
export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading)
    return (
      <main id="main-content" className="auth-state" role="status">
        جارٍ التحقق من الجلسة…
      </main>
    );
  if (!auth.session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!auth.membership)
    return (
      <main id="main-content" className="auth-state">
        <h1>تعذّر فتح مساحة الشركة</h1>
        <p role="alert">{auth.error}</p>
        <button className="primary-button" onClick={auth.reload}>
          إعادة التحقق
        </button>
        <button className="secondary-button" onClick={() => void auth.logout()}>
          تسجيل الخروج
        </button>
      </main>
    );
  return children;
}
