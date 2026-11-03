import { departmentDocuments } from "./catalog";
/** Explicitly fictional data for the isolated, offline demo. Never company policy. */
export const knowledge = [
  {
    id: "company",
    title: "التعريف بالشركة",
    terms: ["الشركة", "شركتكم", "company"],
    steps: [
      "شركة مسار. تعرّف على أقسام الشركة وإجراءات الموظفين من مكان واحد.",
      "أقسام الشركة هي الموارد البشرية (HR)، وتقنية المعلومات (IT)، والمالية (Finance)، والإدارة (Administration)، والتسويق (Marketing)، وضمان الجودة (QA)، والعمليات (Operations).",
    ],
  },
  {
    id: "onboarding",
    title: "دليل الموظف الجديد",
    terms: ["اول يوم", "ابدا", "جديد", "تهيئة", "onboarding", "first day"],
    steps: [
      "ابدأ بالتواصل مع الموارد البشرية (HR) للتعرّف على فريقك واستلام دليل البداية.",
      "بعد ذلك، تواصل مع تقنية المعلومات (IT) لتجهيز جهاز العمل وتفعيل حسابك.",
      "ثم اتفق مع مديرك المباشر على جلسة تعريف بمهامك وقنوات التواصل الداخلية.",
    ],
  },
  {
    id: "leave",
    title: "إجراءات الإجازة",
    terms: ["اجاز", "leave", "vacation"],
    steps: [
      "حدّد تواريخ الإجازة المطلوبة وأرسل الطلب إلى مديرك المباشر.",
      "بعد موافقة المدير، أرسل الطلب إلى الموارد البشرية (HR) لتأكيد تسجيله.",
      "انتظر تأكيد الموارد البشرية (HR) قبل اعتبار الإجازة معتمدة. لا يحدد هذا الدليل رصيدًا أو عدد أيام للإجازات.",
    ],
  },
  {
    id: "it",
    title: "دليل الدعم التقني",
    terms: ["تقني", "جهاز", "حاسوب", "دعم", "it support", "laptop"],
    steps: [
      "للمشكلات التقنية، تواصل مع قسم تقنية المعلومات (IT) عبر قناة الدعم الداخلية.",
      "اذكر وصف المشكلة ورسالة الخطأ ونوع الجهاز، دون إرسال كلمة المرور أو رموز المصادقة متعددة العوامل (MFA).",
      "انتظر تعليمات الفريق. الدليل لا يحدد بريدًا أو رقمًا أو وقت استجابة مضمونًا.",
    ],
  },
  {
    id: "vpn",
    title: "دليل الشبكة الافتراضية الخاصة (VPN)",
    terms: ["vpn", "شبكة افتراضية"],
    steps: [
      "اطلب صلاحية الشبكة الافتراضية الخاصة (VPN) من تقنية المعلومات (IT) عبر قناة الدعم الداخلية.",
      "بعد الموافقة، ثبّت العميل المعتمد الذي يزوّدك به فريق تقنية المعلومات (IT).",
      "سجّل الدخول بحساب العمل وأكمل المصادقة متعددة العوامل (MFA). لا يحدد الدليل اسم العميل أو عنوان الخادم؛ اطلبهما من الفريق.",
    ],
  },
  {
    id: "communication",
    title: "دليل التواصل الداخلي",
    terms: ["تواصل", "اقسام", "قسم", "communication", "department"],
    steps: [
      "الموارد البشرية (HR) مسؤولة عن إجراءات البداية والإجازات؛ وتقنية المعلومات (IT) عن الأجهزة والوصول التقني؛ والعمليات (Operations) عن تنسيق العمل اليومي.",
      "للاستفسار عن مهمة، ابدأ بمديرك المباشر. تجد بيانات تواصل الأقسام في دليل الأقسام.",
    ],
  },
  ...departmentDocuments,
] as const;
export type Topic = (typeof knowledge)[number]["id"];
export type Context = { topic?: Topic; step: number };
export type Reply = {
  text: string;
  status: "verified" | "uncertain" | "unavailable";
  sources: { title: string; quote: string; documentId?: string }[];
  context: Context;
};
export const statusLabels = {
  verified: "إجابة موثقة",
  uncertain: "إجابة غير مؤكدة — يلزم توضيح",
  unavailable: "معلومة غير متوفرة",
};
const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ً-ٟ]/g, "");
export function respond(question: string, context: Context): Reply {
  const q = normalize(question);
  const reply = (
    text: string,
    status: Reply["status"],
    next = context,
  ): Reply => ({ text, status, sources: [], context: next });
  const follow =
    /^(طيب\s*)?(و?بعدها|بعدين|ثم|what next|and then|نعم|ايه|ايوه|yes)[؟?!.\s]*$/.test(
      q,
    );
  const explain =
    /^(وش تقصد|ايش تقصد|وضح|وضح اكثر|ما المقصود|what do you mean|explain)[؟?!.\s]*$/.test(
      q,
    );
  const termMatches = (term: string) => {
    const normalized = normalize(term);
    return /^[a-z ]+$/.test(normalized)
      ? new RegExp(`\\b${normalized}\\b`).test(q)
      : q.includes(normalized);
  };
  const departmentMatches = departmentDocuments.filter((d) =>
    d.terms.some(termMatches),
  );
  const matches = departmentMatches.length
    ? departmentMatches
    : knowledge.filter((d) => d.terms.some(termMatches));
  if ((follow || explain) && !context.topic)
    return reply(
      "عن أي إجراء تقصد؟ يمكننا الحديث عن البداية، الإجازة أو إعداد VPN.",
      "uncertain",
    );
  if (
    !follow &&
    !explain &&
    /^(مرحبا|اهلا|السلام عليكم|hello|hi)[!؟?.\s]*$/.test(q)
  )
    return reply(
      "أهلًا بك في مسار! هل تحتاج مساعدة في أول يوم، الإجازات أو الدعم التقني؟",
      "uncertain",
      { step: 0 },
    );
  if (
    !follow &&
    !explain &&
    (matches.length > 1 || /^(ساعدني|عندي مشكلة|help)[؟?!.\s]*$/.test(q))
  )
    return reply(
      "حتى أوجّهك بدقة، هل تقصد إجراءات الموظف الجديد، الإجازات، أم الدعم التقني؟ حدّد موضوعًا واحدًا.",
      "uncertain",
      { step: 0 },
    );
  // Requests for missing details must never inherit an earlier answer's evidence.
  if (
    !follow &&
    !explain &&
    (/راتب|رواتب|salary|payroll|رصيد|كم يوم|عدد ايام|balance|how many|هاتف|رقم|بريد|email|server address|عنوان الخادم|اسم العميل/.test(
      q,
    ) ||
      !matches.length)
  )
    return reply(
      "لا تتوفر هذه المعلومة في قاعدة المعرفة، ولا أستطيع تأكيدها. يمكنك سؤال الموارد البشرية (HR) عن الجهة المناسبة؛ هذا اقتراح غير مؤكد لسؤالك، وليس إحالة موثقة.",
      "unavailable",
      { step: 0 },
    );
  const doc = knowledge.find(
    (d) => d.id === (follow || explain ? context.topic : matches[0].id),
  )!;
  const step = follow
    ? Math.min(context.step + 1, doc.steps.length)
    : explain
      ? context.step
      : 0;
  if (step >= doc.steps.length)
    return reply(
      "هذه نهاية الخطوات المتوفرة لهذا الإجراء في الدليل. لا توجد خطوات إضافية موثقة. هل تريد الانتقال إلى موضوع آخر؟",
      "unavailable",
      { topic: doc.id, step },
    );
  const quote = doc.steps[step];
  return {
    text: `${explain ? "المقصود بالخطوة السابقة، بحسب نص الدليل: " : ""}${quote}${step < doc.steps.length - 1 ? " هل تريد معرفة الخطوة التالية؟" : " هل لديك سؤال عن إجراء آخر؟"}`,
    status: "verified",
    sources: [{ title: doc.title, quote, documentId: doc.id }],
    context: { topic: doc.id, step },
  };
}
