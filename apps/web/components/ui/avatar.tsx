const SIZE = {
  sm: "size-8 text-xs",
  md: "size-12 text-sm",
  lg: "size-18 text-lg",
} as const;

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Replaces .av/.patient-avatar — a circular initials placeholder. */
export function InitialsAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: keyof typeof SIZE;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-100 font-bold text-primary-800 ${SIZE[size]}`}
    >
      {initials(name)}
    </span>
  );
}
