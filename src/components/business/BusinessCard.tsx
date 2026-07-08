import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Star, BadgeCheck, MessageCircle, Clock, Tag } from "lucide-react";
import { StarRating } from "./StarRating";
import { Button } from "@/components/ui/button";
import { BusinessPhotoImage } from "./BusinessPhotoImage";
import { FavoriteButton } from "./FavoriteButton";
import { isOpenNow, hasAnyHours } from "@/lib/business-hours";
import { useEffect, useState } from "react";

interface BusinessCardProps {
  business: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    verified: boolean;
    featured_image: string | null;
    featured_image_url?: string | null;
    hours?: unknown;
    avgRating?: number;
    reviewCount?: number;
    app_discount_percent?: number | null;
    app_discount_valid_until?: string | null;
    categories: { id: string; name: string; slug: string; color: string | null } | null;
  };
}

export function BusinessCard({ business }: BusinessCardProps) {
  const imageSrc = business.featured_image_url ?? business.featured_image;
  const hasHours = hasAnyHours(business.hours);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const openState = mounted ? isOpenNow(business.hours) : null;
  const isOpen = openState === true;
  const discountActive =
    typeof business.app_discount_percent === "number" &&
    business.app_discount_percent > 0 &&
    (!business.app_discount_valid_until ||
      new Date(business.app_discount_valid_until) >= new Date(new Date().toDateString()));
  const cleanPhone = business.phone?.replace(/[^\d+]/g, "") ?? "";
  const waHref = cleanPhone
    ? `https://wa.me/${cleanPhone.replace(/^\+/, "")}?text=${encodeURIComponent(
        `Hi, I found ${business.name} on Kutchi Hub. `,
      )}`
    : "";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link to="/business/$slug" params={{ slug: business.slug }} className="absolute inset-0 z-10" />
      <div className="relative h-40 overflow-hidden bg-muted">
        {imageSrc ? (
          <BusinessPhotoImage
            src={imageSrc}
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
        {discountActive && (
          <div className="absolute right-2 bottom-2 z-10 flex items-center gap-1 rounded-full bg-[#ff6a00] px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Tag className="h-3 w-3" />
            {business.app_discount_percent}% App Discount
          </div>
        )}
        <div className="absolute left-2 top-2 z-20">
          <FavoriteButton businessId={business.id} size="sm" />
        </div>
        {hasHours && mounted && openState !== null && (
          <div
            className={`absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
              isOpen
                ? "bg-emerald-500/95 text-white"
                : "bg-red-500/95 text-white"
            }`}
          >
            <Clock className="h-3 w-3" />
            {isOpen ? "Open now" : "Closed"}
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
            className="flex-1 px-2"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = `tel:${business.phone}`;
            }}
            disabled={!business.phone}
          >
            <Phone className="mr-1 h-3.5 w-3.5" />
            Call
          </Button>
          {business.phone && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-emerald-500/30 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(waHref, "_blank", "noopener,noreferrer");
              }}
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle className="mr-1 h-3.5 w-3.5" />
              WhatsApp
            </Button>
          )}
          <Button size="sm" className="flex-1 bg-primary px-2 text-primary-foreground" asChild>
            <Link to="/business/$slug" params={{ slug: business.slug }}>
              Details
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
