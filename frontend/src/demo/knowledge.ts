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
  status: "verified" | "uncertain" | "unavailable" | "conversational";
  sources: {
    title: string;
    quote: string;
    documentId?: string;
    id?: string;
    document_id?: string;
    section?: string;
    excerpt?: string;
    url?: string | null;
  }[];
  context: Context;
};
export const statusLabels = {
  conversational: "معك مسار",
  verified: "إجابة موثقة",
  uncertain: "إجابة غير مؤكدة — يلزم توضيح",
  unavailable: "معلومة غير متوفرة",
};
const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[ً-ٟ]/g, "");
export function respond(question: string, context: Context): Reply {
  const q = normalize(question);
  const reply = (
    text: string,
    status: Reply["status"],
    next = context,
  ): Reply => ({ text, status, sources: [], context: next });
  // Strip a greeting only at the start; a greeting plus a question still answers it.
  const greeting =
    /^(?:السلام عليكم(?: ورحمة الله(?: وبركاته)?)?|وعليكم السلام|مرحبا|اهلا(?: وسهلا)?|هلا(?: والله)?|يا هلا|صباح الخير|مساء الخير|hello|hi)(?=$|[،,!؟?.\s])/;
  const query = q.replace(greeting, "").replace(/^[،,!؟?.\s]+/, "");
  const follow =
    /^(?:(?:طيب|تمام|زين)\s*)?(?:و?بعدها|و?بعدين|ثم|وش بعدها|ايش بعدها|وش الخطوه التاليه|وش الخطوة التالية|كمل|كمل الخطوات|what next|and then|نعم|ايه|ايوه|yes)[؟?!.\s]*$/.test(
      query,
    );
  const explain =
    /^(?:(?:طيب)\s*)?(?:وش تقصد|ايش تقصد|وضح|وضح اكثر|ما المقصود|what do you mean|explain)[؟?!.\s]*$/.test(
      query,
    );
  const contact =
    /مين اكلم|من اكلم|مع مين اتواصل|كيف اتواصل|جهة التواصل|بريد|email|contact/.test(
      query,
    );
  const responsibilities = /مهام|مسؤول|مسئول|يسوي|يسوون|خدمات/.test(query);
  const termMatches = (term: string) => {
    const normalized = normalize(term);
    return /^[a-z ]+$/.test(normalized)
      ? new RegExp(`\\b${normalized}\\b`).test(query)
      : query.includes(normalized);
  };
  const aliases: Record<string, RegExp> = {
    onboarding: /اول يوم|موظف جديد|توني متوظف|توني بادي|وش اسوي اول|ابدا دوامي/,
    leave: /اجاز|عطله|عطلة|leave|vacation/,
    it: /تقني|جهاز|لابتوب|كمبيوتر|حاسوب|دعم|خربان|ما يشتغل/,
    vpn: /vpn|شبكه افتراضيه|شبكة افتراضية|الشبكة الافتراضية/,
    communication: /الاقسام|اقسام الشركه|اقسام الشركة/,
  };
  const procedural = knowledge.filter(
    (d) =>
      !d.id.startsWith("department-") &&
      (aliases[d.id]?.test(query) || d.terms.some(termMatches)),
  );
  const departmentMatches = departmentDocuments.filter((d) =>
    d.terms.some(termMatches),
  );
  // Specific procedures outrank generic words such as company or department.
  const specific = procedural.filter(
    (d) => !["company", "communication"].includes(d.id),
  );
  const matches =
    departmentMatches.length && !/اجاز|vpn|اول يوم|موظف جديد|توني/.test(query)
      ? departmentMatches
      : specific.length
        ? specific
        : departmentMatches.length
          ? departmentMatches
          : procedural;
  if (!query && greeting.test(q))
    return reply(
      "وعليكم السلام وأهلًا بك! أنا مسار، أساعدك في إجراءات البداية والإجازات والأقسام والدعم التقني. وش حاب تعرف؟",
      "conversational",
    );
  if (
    /^(شكرا|شكراً|يعطيك العافيه|يعطيك العافية|مشكور|تسلم|thanks)[؟?!.\s]*$/.test(
      query,
    )
  )
    return reply(
      "العفو، حياك الله! إذا حاب نكمل الإجراء قل: وبعدها؟ أو اسأل عن موضوع آخر.",
      "conversational",
    );
  if ((follow || explain) && !context.topic)
    return reply(
      "عن أي إجراء تقصد؟ يمكننا الحديث عن البداية، الإجازة أو إعداد VPN.",
      "uncertain",
    );
  if (
    !follow &&
    !explain &&
    (matches.length > 1 || /^(ساعدني|عندي مشكلة|help)[؟?!.\s]*$/.test(query))
  )
    return reply(
      `حتى أوجّهك بدقة، هل تقصد ${matches.length ? matches.map((d) => d.title).join(" أم ") : "إجراءات الموظف الجديد، الإجازات، أم الدعم التقني"}؟`,
      "uncertain",
    );
  // Contextual questions resolve to the current topic only when explicitly referring back.
  const contextual =
    !!context.topic &&
    !matches.length &&
    (contact ||
      responsibilities ||
      /عنها|عنه|هذا الاجراء|هالاجراء/.test(query));
  // Requests for missing details must never inherit an earlier answer's evidence.
  if (
    !follow &&
    !explain &&
    (/راتب|رواتب|salary|payroll|رصيد|كم يوم|عدد ايام|balance|how many|هاتف|رقم|server address|عنوان الخادم|اسم العميل/.test(
      q,
    ) ||
      (!matches.length && !contextual))
  )
    return reply(
      "لا تتوفر هذه المعلومة في قاعدة المعرفة، ولا أستطيع تأكيدها. يمكنك سؤال الموارد البشرية (HR) عن الجهة المناسبة؛ هذا اقتراح غير مؤكد لسؤالك، وليس إحالة موثقة.",
      "unavailable",
      { step: 0 },
    );
  const doc = knowledge.find(
    (d) =>
      d.id ===
      (follow || explain || contextual ? context.topic : matches[0].id),
  )!;
  const relatedDepartment = doc.id.startsWith("department-")
    ? doc
    : departmentDocuments.find(
        (d) =>
          d.id ===
          (doc.id === "leave" || doc.id === "onboarding"
            ? "department-hr"
            : doc.id === "vpn" || doc.id === "it"
              ? "department-it"
              : ""),
      );
  if ((contact || responsibilities) && relatedDepartment) {
    const quote = relatedDepartment.steps[contact ? 2 : 1]!;
    return {
      text: quote,
      status: "verified",
      sources: [
        {
          title: relatedDepartment.title,
          quote,
          documentId: relatedDepartment.id,
        },
      ],
      context: { topic: doc.id, step: contextual ? context.step : 0 },
    };
  }
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
