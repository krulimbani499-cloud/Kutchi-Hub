import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
  showValue?: boolean;
}

export function StarRating({ rating, size = "sm", showValue = true }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i < fullStars || (i === fullStars && hasHalf);
          return (
            <Star
              key={i}
              className={`${sizeClass} ${filled ? "fill-rating text-rating" : "text-muted-foreground"}`}
            />
          );
        })}
      </div>
      {showValue && <span className="text-sm font-medium text-foreground">{rating.toFixed(1)}</span>}
    </div>
  );
}
