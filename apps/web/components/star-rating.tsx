import { Star } from "lucide-react";

/** Plain markup, no client interactivity needed — safe in Server Components. */
export function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={i < filled ? "size-3.5 fill-warning-fg text-warning-fg" : "size-3.5 text-border-strong"}
        />
      ))}
    </span>
  );
}
