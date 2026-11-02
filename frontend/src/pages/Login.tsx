import { apiRequest } from "../lib/api";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpLeft,
  Compass,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
export default function Login() {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "أدخل بريدًا إلكترونيًا صالحًا.";
    if (!password) next.password = "أدخل كلمة المرور.";
    setErrors(next);
    setNotice("");
    if (Object.keys(next).length) return;
    setLoading(true);
    try {
      const r = await apiRequest("/auth/login", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      setNotice(
        r.status === 501
          ? "تسجيل الدخول غير مفعّل في هذه المرحلة. لم تُرسل بياناتك، ولم يتم إنشاء جلسة."
          : "خدمة المصادقة غير متاحة حاليًا. لم يتم تسجيل الدخول.",
      );
    } catch {
      setNotice(
        "تعذّر الوصول إلى خدمة المصادقة. لم تُرسل بياناتك ولم يتم تسجيل الدخول.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login-page" id="main-content">
      <section className="login-form-side">
        <Link to="/" className="login-back">
          <ArrowRight size={18} />
          العودة إلى مساحة العمل
        </Link>
        <div className="login-form-wrap">
          <Link className="brand login-brand" to="/">
            <span className="brand-mark">
              <Compass size={31} />
            </span>
            <span>
              مسار<small>معرفة ترشدك.</small>
            </span>
          </Link>
          <p className="eyebrow">خطوتك التالية تبدأ هنا</p>
          <h1>أهلًا بعودتك.</h1>
          <p className="muted">ادخل إلى مساحة المعرفة الخاصة بشركتك.</p>
          <form noValidate onSubmit={submit}>
            <label htmlFor="email">البريد الإلكتروني للعمل</label>
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="username"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <p id="email-error" className="field-error">
                {errors.email}
              </p>
            )}
            <label htmlFor="password">كلمة المرور</label>
            <div className="password-field">
              <input
                id="password"
                dir="ltr"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              <button
                type="button"
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" className="field-error">
                {errors.password}
              </p>
            )}
            <button className="primary-button login-submit" disabled={loading}>
              {loading ? "جارٍ التحقق من توفر الخدمة…" : "تسجيل الدخول"}
              <ArrowUpLeft size={18} />
            </button>
            {notice && (
              <p className="login-notice" role="alert">
                {notice}
              </p>
            )}
          </form>
          <p className="login-disclaimer">
            <ShieldCheck size={16} />
            المصادقة غير مفعّلة في النسخة التأسيسية.
          </p>
        </div>
        <span className="muted small">مسار — معرفة مؤسسية، بخطوات أوضح.</span>
      </section>
      <section className="login-story">
        <div className="story-top">مساحة واحدة. معرفة أقرب.</div>
        <div className="path-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <Compass size={75} strokeWidth={0.6} />
        </div>
        <div className="story-copy">
          <span className="eyebrow">من أول يوم، أنت على مسار أوضح</span>
          <h2>
            كل سؤال،
            <br />
            يفتح لك طريقًا.
          </h2>
          <p>
            اكتشف سياسات شركتك، افهم إجراءاتها،
            <br />
            واعرف إلى أين تتجه. بثقة.
          </p>
        </div>
        <div className="story-bottom">
          <span>عربية في لغتها. واضحة في معرفتها.</span>
          <Compass size={22} />
        </div>
      </section>
    </main>
  );
}
