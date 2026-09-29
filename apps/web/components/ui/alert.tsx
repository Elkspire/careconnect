import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const TONE = {
  danger: { classes: "bg-danger-bg text-danger-fg", icon: XCircle },
  warning: { classes: "bg-warning-bg text-warning-fg", icon: AlertTriangle },
  info: { classes: "bg-info-bg text-info-fg", icon: Info },
  success: { classes: "bg-success-bg text-success-fg", icon: CheckCircle2 },
} as const;

/** Replaces .alert and doubles for the .locked/.lockmsg access-denied box. */
export function Alert({
  tone = "info",
  title,
  description,
}: {
  tone?: keyof typeof TONE;
  title: string;
  description?: ReactNode;
}) {
  const { classes, icon: Icon } = TONE[tone];
  return (
    <div className={`flex items-start gap-3 rounded-md px-4 py-3 ${classes}`}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-sm opacity-90">{description}</p>}
      </div>
    </div>
  );
}
