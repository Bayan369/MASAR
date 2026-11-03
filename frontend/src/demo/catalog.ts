/** Fictional company data. All contacts use the reserved .invalid domain. */
export const departments = [
  {
    id: "hr",
    name: "الموارد البشرية",
    term: "HR",
    about:
      "يرافق الموظف في بداية رحلته وينظم إجراءاته الوظيفية في الشركة التجريبية.",
    responsibilities: [
      "تنسيق استقبال الموظفين الجدد",
      "تسجيل طلبات الإجازة بعد موافقة المدير",
    ],
    services: ["دليل البداية", "تأكيد تسجيل الإجازات"],
    when: "عند بدء العمل أو متابعة تسجيل إجازة وافق عليها المدير.",
    contact: "hr@masar-demo.invalid",
    aliases: ["الموارد البشرية", "hr", "human resources"],
  },
  {
    id: "it",
    name: "تقنية المعلومات",
    term: "IT",
    about: "يساعد الموظف في تجهيز أدوات العمل والوصول التقني الآمن.",
    responsibilities: [
      "تجهيز الأجهزة وحسابات العمل",
      "إرشاد الموظف لإعداد VPN وMFA",
    ],
    services: ["الدعم التقني", "طلب صلاحيات VPN"],
    when: "عند تعطل الجهاز أو الحاجة إلى حساب عمل أو وصول تقني.",
    contact: "it@masar-demo.invalid",
    aliases: ["تقنية المعلومات", "قسم it", "it department"],
  },
  {
    id: "finance",
    name: "المالية",
    term: "Finance",
    about: "ينظم المستندات المالية الداخلية في هذا المثال التعليمي.",
    responsibilities: [
      "مراجعة المستندات المالية المحالة من المدير",
      "توضيح مسار الاستفسارات المالية",
    ],
    services: ["إرشادات المستندات المالية"],
    when: "عند الحاجة لمعرفة جهة مراجعة مستند مالي؛ لا يتضمن الديمو رواتب أو مبالغ أو استحقاقات.",
    contact: "finance@masar-demo.invalid",
    aliases: ["المالية", "finance"],
  },
  {
    id: "administration",
    name: "الإدارة",
    term: "Administration",
    about: "تنسق احتياجات مقر العمل والتجهيزات المكتبية في المثال التجريبي.",
    responsibilities: [
      "تنسيق استقبال الموظف في المقر",
      "متابعة طلبات التجهيزات المكتبية",
    ],
    services: ["إرشادات الوصول للمقر", "طلبات التجهيز المكتبي"],
    when: "عند الحاجة إلى تجهيز مكتبي أو توجيه داخل المقر.",
    contact: "administration@masar-demo.invalid",
    aliases: ["الادارة", "administration"],
  },
  {
    id: "marketing",
    name: "التسويق",
    term: "Marketing",
    about: "ينظم المحتوى التعريفي ومواد التواصل الخاصة بالشركة التجريبية.",
    responsibilities: ["تنسيق المواد التعريفية", "مراجعة المحتوى الاتصالي"],
    services: ["طلب مواد تعريفية"],
    when: "عند إعداد مادة تعريفية أو محتوى يتعلق بالشركة.",
    contact: "marketing@masar-demo.invalid",
    aliases: ["التسويق", "marketing"],
  },
  {
    id: "qa",
    name: "ضمان الجودة",
    term: "QA",
    about:
      "يساعد الفرق على توثيق الملاحظات وتحسين جودة إجراءات العمل التجريبية.",
    responsibilities: [
      "مراجعة وضوح الإجراءات",
      "تنسيق ملاحظات الجودة مع الفريق المعني",
    ],
    services: ["إرشادات توثيق ملاحظات الجودة"],
    when: "عند ملاحظة مشكلة في وضوح إجراء أو جودة مخرجات العمل.",
    contact: "qa@masar-demo.invalid",
    aliases: ["ضمان الجودة", "qa", "quality assurance"],
  },
  {
    id: "operations",
    name: "العمليات",
    term: "Operations",
    about: "ينسق العمل اليومي بين الفرق ويساعد في فهم مسار الإجراءات.",
    responsibilities: [
      "تنسيق العمل اليومي",
      "توضيح تسلسل الإجراءات بين الأقسام",
    ],
    services: ["توجيه إجرائي بين الفرق"],
    when: "عند عدم وضوح تسلسل إجراء عملي أو الحاجة إلى تنسيق بين قسمين.",
    contact: "operations@masar-demo.invalid",
    aliases: ["العمليات", "operations"],
  },
] as const;
export const departmentDocuments = departments.map((d) => ({
  id: `department-${d.id}`,
  title: `بطاقة قسم ${d.name} (${d.term}) التجريبية`,
  terms: [...d.aliases],
  steps: [
    d.about,
    `المسؤوليات: ${d.responsibilities.join("، ")}. الخدمات: ${d.services.join("، ")}.`,
    `متى تتواصل؟ ${d.when} جهة التواصل التجريبية: ${d.contact} — عنوان غير فعلي، لا يُستخدم للمراسلة.`,
  ],
}));
export const demoNavigation = [
  { path: "/demo", label: "الرئيسية", term: "Home" },
  { path: "/demo/departments", label: "دليل الأقسام", term: "Departments" },
  {
    path: "/demo/onboarding",
    label: "دليل الموظف الجديد",
    term: "Getting Started",
  },
  { path: "/demo/policies", label: "السياسات والإجراءات", term: "Policies" },
  { path: "/demo/documents", label: "المستندات والملفات", term: "Documents" },
  { path: "/demo/assistant", label: "مسار الذكي", term: "MASAR AI" },
];
