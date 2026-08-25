/** Plain markup, no client interactivity needed — safe in Server Components. */
export function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < filled ? "" : "empty"}>
          ★
        </span>
      ))}
    </span>
  );
}
