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
      : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";

  return (
    <div className={`grid gap-3 ${sizeClasses}`}>
      {categories.map((category) => {
        const Icon = iconMap[category.icon ?? ""] ?? Circle;
        return (
          <Link
            key={category.id}
            to="/search"
            search={{ category: category.slug }}
            className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 text-center transition-colors hover:border-primary/30 hover:bg-accent"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: category.color ?? "var(--primary)" }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-medium text-foreground">{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
