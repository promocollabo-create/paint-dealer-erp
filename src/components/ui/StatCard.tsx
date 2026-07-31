import { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  icon: Icon,
  accent
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="card flex items-start justify-between">
      <div>
        <p className="text-sm text-ink-500 dark:text-ink-400">{label}</p>
        <p className="mt-1.5 font-display text-2xl font-semibold text-ink-900 dark:text-white">{value}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}1A`, color: accent }}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
