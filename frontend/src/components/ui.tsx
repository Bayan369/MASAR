import type { ReactNode } from "react";
import {
  BookOpen,
  Building2,
  CircleHelp,
  LayoutDashboard,
  MessageSquare,
  Monitor,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Megaphone,
  Layers,
  BriefcaseBusiness,
} from "lucide-react";
const icons = {
  dashboard: LayoutDashboard,
  assistant: Sparkles,
  departments: Building2,
  knowledge: BookOpen,
  history: MessageSquare,
  settings: Settings,
  it: Monitor,
  hr: Users,
  finance: Wallet,
  admin: BriefcaseBusiness,
  marketing: Megaphone,
  qa: ShieldCheck,
  operations: Layers,
};
export function Icon({ name, size = 21 }: { name: string; size?: number }) {
  const Component = icons[name as keyof typeof icons] || CircleHelp;
  return <Component size={size} aria-hidden="true" strokeWidth={1.7} />;
}
export function Term({ children }: { children: ReactNode }) {
  return (
    <bdi className="term" dir="ltr">
      ({children})
    </bdi>
  );
}
export function EmptyState({
  title,
  description,
  icon = "history",
  children,
}: {
  title: string;
  description: string;
  icon?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
  );
}
export function SectionHeading({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
