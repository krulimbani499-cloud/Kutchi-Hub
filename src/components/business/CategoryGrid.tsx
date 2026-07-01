import { Link } from "@tanstack/react-router";
import * as LucideIcons from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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
        const Icon = (LucideIcons as Record<string, React.ComponentType<{ className?: string }>>)[
          category.icon ?? "Circle"
        ] ?? LucideIcons.Circle;
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
