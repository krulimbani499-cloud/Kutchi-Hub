import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";

// Colorful emoji icons in JustDial style — mapped by icon key or category slug/name.
const emojiMap: Record<string, string> = {
  utensils: "🍽️",
  restaurants: "🍽️",
  bed: "🏨",
  hotels: "🏨",
  stethoscope: "🩺",
  doctors: "🩺",
  hospitals: "🏥",
  "graduation-cap": "🎓",
  education: "🎓",
  "driving-schools": "🚗",
  "shopping-cart": "🛒",
  shopping: "🛍️",
  scissors: "💇",
  salon: "💇",
  "beauty-spa": "💆",
  beauty: "💆",
  landmark: "🏦",
  banks: "🏦",
  loans: "💰",
  car: "🚙",
  cars: "🚙",
  home: "🏠",
  "home-decor": "🛋️",
  "real-estate": "🏡",
  "estate-agent": "🏘️",
  "pg-hostels": "🛏️",
  dumbbell: "🏋️",
  gym: "🏋️",
  dentists: "🦷",
  wedding: "💍",
  "wedding-planning": "💍",
  "rent-hire": "🔑",
  "event-organisers": "🎉",
  events: "🎉",
  "packers-movers": "🚚",
  repairs: "🔧",
  b2b: "🤝",
};

function pickEmoji(icon: string | null, slug: string) {
  return (
    emojiMap[icon ?? ""] ??
    emojiMap[slug] ??
    emojiMap[slug.replace(/[^a-z0-9]+/g, "-")] ??
    "📍"
  );
}

interface CategoryGridProps {
  categories: Tables<"categories">[];
  size?: "sm" | "md";
}

export function CategoryGrid({ categories, size = "md" }: CategoryGridProps) {
  const sizeClasses =
    size === "sm"
      ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
      : "grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10";

  return (
    <div className={`grid gap-3 ${sizeClasses}`}>
      {categories.map((category) => {
        const emoji = pickEmoji(category.icon, category.slug);
        return (
          <Link
            key={category.id}
            to="/search"
            search={{ category: category.slug }}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 text-3xl leading-none">
              <span aria-hidden>{emoji}</span>
            </div>
            <span className="text-xs font-medium text-foreground leading-tight">{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
