// Arabic is the active locale. Keep shared copy here to support future locale dictionaries.
export const ar = {
  navigation: [
    { path: "/", label: "لوحة التحكم", term: "Dashboard", icon: "dashboard" },
    {
      path: "/assistant",
      label: "المساعد الذكي",
      term: "AI Assistant",
      icon: "assistant",
    },
    {
      path: "/departments",
      label: "الأقسام",
      term: "Departments",
      icon: "departments",
    },
    {
      path: "/knowledge",
      label: "قاعدة المعرفة",
      term: "Knowledge Base",
      icon: "knowledge",
    },
    {
      path: "/history",
      label: "المحادثات السابقة",
      term: "Conversation History",
      icon: "history",
    },
    {
      path: "/settings",
      label: "الملف الشخصي والإعدادات",
      term: "Profile & Settings",
      icon: "settings",
    },
  ],
  questions: [
    "كيف أطلب صلاحية الشبكة الافتراضية الخاصة (VPN)؟",
    "كيف أطلب إجازة؟",
    "كيف أستلم جهاز العمل؟",
    "من المسؤول عن الدعم التقني؟",
    "أين أجد سياسات الشركة؟",
  ],
};
export const departments = [
  {
    name: "تقنية المعلومات",
    term: "IT",
    description: "أجهزة العمل، الأنظمة الداخلية، الوصول الآمن والدعم التقني.",
    icon: "it",
  },
  {
    name: "الموارد البشرية",
    term: "HR",
    description: "سياسات العمل، الإجازات وتجربة الموظف داخل الشركة.",
    icon: "hr",
  },
  {
    name: "المالية",
    term: "Finance",
    description: "الإجراءات المالية، المصروفات وسياسات التعويضات.",
    icon: "finance",
  },
  {
    name: "الإدارة",
    term: "Administration",
    description: "خدمات المكاتب، المرافق والإجراءات الإدارية.",
    icon: "admin",
  },
  {
    name: "التسويق",
    term: "Marketing",
    description: "هوية الشركة، التواصل والمحتوى والحملات.",
    icon: "marketing",
  },
  {
    name: "ضمان الجودة",
    term: "QA",
    description: "معايير الجودة، مراجعة الإجراءات والتحسين المستمر.",
    icon: "qa",
  },
  {
    name: "العمليات",
    term: "Operations",
    description: "تنسيق الأعمال اليومية وتطوير كفاءة العمليات.",
    icon: "operations",
  },
];
