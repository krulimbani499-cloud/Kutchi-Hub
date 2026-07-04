import { Link } from "@tanstack/react-router";
import {
  Utensils,
  Bed,
  Stethoscope,
  GraduationCap,
  ShoppingCart,
  Scissors,
  Landmark,
  Car,
  Home,
  Dumbbell,
  Circle,
  type LucideIcon,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const iconMap: Record<string, LucideIcon> = {
  utensils: Utensils,
  bed: Bed,
  stethoscope: Stethoscope,
  "graduation-cap": GraduationCap,
  "shopping-cart": ShoppingCart,
  scissors: Scissors,
  landmark: Landmark,
  car: Car,
  home: Home,
  dumbbell: Dumbbell,
};

interface CategoryGridProps {
  categories: Tables<"categories">[];
  size?: "sm" | "md";
}

export function CategoryGrid({ categories, size = "md" }: CategoryGridProps) {
  const sizeClasses =
    size === "sm"
      ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
      : "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8";

  return (
    <div className={`grid gap-4 ${sizeClasses}`}>
      {categories.map((category) => {
        const Icon = iconMap[category.icon ?? ""] ?? Circle;
        return (
          <Link
            key={category.id}
            to="/search"
            search={{ category: category.slug }}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-inner"
              style={{ backgroundColor: category.color ?? "var(--primary)" }}
            >
              <Icon className="h-7 w-7" />
            </div>
            <span className="text-sm font-semibold text-foreground leading-tight">{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
