import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Star, BadgeCheck } from "lucide-react";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

interface BusinessCardProps {
  business: Tables<"businesses"> & {
    categories: { id: string; name: string; slug: string; color: string | null } | null;
    avgRating?: number;
    reviewCount?: number;
  };
}

export function BusinessCard({ business }: BusinessCardProps) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link to="/business/$slug" params={{ slug: business.slug }} className="absolute inset-0 z-10" />
      <div className="relative h-40 overflow-hidden bg-muted">
        {business.featured_image ? (
          <img
            src={business.featured_image}
            alt={business.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
            {business.categories?.name ?? "Business"}
          </div>
        )}
        {business.verified && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-medium text-success-foreground">
            <BadgeCheck className="h-3 w-3" />
            Verified
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-semibold text-foreground">{business.name}</h3>
          <div className="flex shrink-0 items-center gap-1 rounded bg-rating/10 px-1.5 py-0.5 text-xs font-medium text-rating">
            <Star className="h-3 w-3 fill-rating text-rating" />
            {(business.avgRating ?? 0).toFixed(1)}
          </div>
        </div>
        <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">
          {business.categories?.name ?? "Business"}
          {business.reviewCount ? ` · ${business.reviewCount} reviews` : null}
        </p>
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{business.description}</p>
        <div className="mt-auto space-y-1.5 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{business.address ?? business.city}</span>
          </div>
          {business.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{business.phone}</span>
            </div>
          )}
        </div>
        <div className="relative z-20 mt-4 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `tel:${business.phone}`;
            }}
            disabled={!business.phone}
          >
            <Phone className="mr-1 h-3.5 w-3.5" />
            Call
          </Button>
          <Button size="sm" className="flex-1 bg-primary text-primary-foreground" asChild>
            <Link to="/business/$slug" params={{ slug: business.slug }}>
              Details
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
