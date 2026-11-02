import { useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseClient } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
export default function Recovery() {
  const { session } = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const client = getSupabaseClient();
      if (session) {
        if (password.length < 12) {
          setMessage("استخدم كلمة مرور لا تقل عن 12 حرفًا.");
          return;
        }
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setMessage("حُدّثت كلمة المرور بنجاح.");
      } else {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin + "/reset-password" },
        );
        if (error) throw error;
        setMessage("إذا كان البريد مرتبطًا بحساب، ستصلك تعليمات الاستعادة.");
      }
    } catch {
      setMessage(
        "تعذّر إتمام العملية. تحقق من البيانات أو صلاحية رابط الاستعادة.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main id="main-content" className="auth-state">
      <h1>استعادة كلمة المرور</h1>
      <p>
        افتح رابط الدعوة أو الاستعادة المرسل إلى بريدك لتعيين كلمة مرور جديدة.
      </p>
      <form className="product-form" onSubmit={submit}>
        {session ? (
          <label>
            كلمة مرور جديدة
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : (
          <label>
            البريد الإلكتروني
            <input
              type="email"
              dir="ltr"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        <button className="primary-button" disabled={loading}>
          {loading
            ? "جارٍ الإرسال…"
            : session
              ? "حفظ كلمة المرور"
              : "إرسال رابط الاستعادة"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      <Link className="text-link" to={session ? "/" : "/login"}>
        العودة إلى مسار
      </Link>
    </main>
  );
}
