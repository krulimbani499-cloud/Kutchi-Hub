import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronLeft, ChevronRight, Clock, Crown, MapPin, MessageCircle, Navigation, Phone, Star, Tag } from "lucide-react";
import { BlurFillImage } from "@/components/business/BlurFillImage";
import { FavoriteButton } from "@/components/business/FavoriteButton";
import { SHOW_SAVED } from "@/lib/features";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusinessPhotoStorageKey } from "@/lib/business-photos";
import { hasAnyHours, isOpenNow } from "@/lib/business-hours";
import { plainPreview } from "@/lib/rich-text";
import { telHref, whatsappHref } from "@/lib/phone";
import { formatDistance } from "@/lib/search-filters";
import { useDiwali } from "@/hooks/useDiwali";
import { useT } from "@/lib/i18n";

export interface ResultBusiness {
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
  plan_tier_order?: number | null;
  hours?: unknown;
  avgRating?: number;
  reviewCount?: number;
  app_discount_percent?: number | null;
  app_discount_valid_until?: string | null;
  categories: { id: string; name: string; slug: string; color: string | null } | null;
  /** More photos of the business (the card swipes through them after the main one). */
  photos?: string[];
  /** A few service names (empty when the owner switched Services off on the profile). */
  serviceTags?: string[];
  /** Kilometres from the visitor (or from the chosen city), when a position is known. */
  distanceKm?: number | null;
  /** Product / service names that matched the search text ("Plywood 18mm"); only ever names the owner shows publicly. */
  matchedHas?: string[];
  /** The city and / or category that matched the search text ("Dahegam"). */
  matchedIn?: string[];
}

/** Platinum and above are shown first as before; the list marks them with a small "Ad" label. */
const AD_TIER = 4;
const MIN_SWIPE_PX = 40;

/**
 * One result in the list view. Wide screens: the photo on the left, the details on the right. Phones: the same details stacked,
 * with the three buttons as one full-width row. The photo box has a fixed shape, so nothing moves while pictures load.
 */
export function ResultCard({
  business,
  distanceFrom = "you",
  priority = false,
}: {
  business: ResultBusiness;
  /** What the distance is measured from: the visitor's own position, or the centre of the chosen city. */
  distanceFrom?: "you" | "city";
  /** The first cards of the page load their photo at once instead of lazily. */
  priority?: boolean;
}) {
  const t = useT();
  const diwali = useDiwali().active;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const openState = mounted && hasAnyHours(business.hours) ? isOpenNow(business.hours) : null;

  // The main photo first, then the others (the same picture is never listed twice).
  const photos = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of [business.featured_image_url ?? business.featured_image, ...(business.photos ?? [])]) {
      if (!p) continue;
      const key = getBusinessPhotoStorageKey(p) ?? p;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  }, [business.featured_image_url, business.featured_image, business.photos]);
  const [index, setIndex] = useState(0);
  const current = photos.length ? photos[index % photos.length] : null;
  const go = (step: number) => setIndex((i) => (i + step + photos.length) % photos.length);

  // Swipe on a phone: a sideways drag changes the photo; a plain tap still opens the business.
  const touchX = useRef<number | null>(null);
  const lastX = useRef<number | null>(null);
  const swiped = useRef(false);

  const tier = business.plan_tier_order ?? 0;
  const discountActive =
    typeof business.app_discount_percent === "number" &&
    business.app_discount_percent > 0 &&
    (!business.app_discount_valid_until || new Date(business.app_discount_valid_until) >= new Date(new Date().toDateString()));
  const wa = business.phone ? whatsappHref(business.phone, `Hi, I found ${business.name} on Kutchi Hub. `) : null;
  const place = [business.categories?.name, business.city].filter(Boolean).join(" · ");
  const distance = business.distanceKm != null ? formatDistance(business.distanceKm) : "";
  const preview = plainPreview(business.description);

  return (
    <article
      data-result-card
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md sm:flex-row"
    >
      {/* The whole card opens the business; the photo, the arrows and the buttons sit above this link. */}
      <Link to="/business/$slug" params={{ slug: business.slug }} aria-label={business.name} className="absolute inset-0 z-10" />

      {/* Photo: ONE shape everywhere, 4:3 (like the home cards and the cover). Phones: full width on top. Wide screens: a fixed-width
          4:3 picture at the top left with a little margin, so it never stretches with the text next to it. */}
      <div className="relative z-20 w-full shrink-0 sm:w-[16.5rem] sm:self-start sm:p-3 md:w-[17.5rem]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted sm:rounded-xl">
        <Link
          to="/business/$slug"
          params={{ slug: business.slug }}
          tabIndex={-1}
          aria-hidden
          className="block h-full w-full"
          // pan-y: the page still scrolls up and down over the photo, but a sideways drag is ours (it changes the photo).
          style={{ touchAction: "pan-y" }}
          onTouchStart={(e) => {
            touchX.current = lastX.current = e.touches[0]?.clientX ?? null;
            swiped.current = false;
          }}
          onTouchMove={(e) => {
            lastX.current = e.touches[0]?.clientX ?? lastX.current;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            touchX.current = null;
            const end = e.changedTouches[0]?.clientX ?? lastX.current;
            if (start === null || end === null || photos.length < 2) return;
            if (Math.abs(end - start) >= MIN_SWIPE_PX) {
              swiped.current = true;
              go(end < start ? 1 : -1);
            }
          }}
          onClick={(e) => {
            if (swiped.current) {
              e.preventDefault(); // that was a swipe, not a tap
              swiped.current = false;
            }
          }}
        >
          <BlurFillImage
            src={current}
            alt={business.name}
            loading={priority ? "eager" : "lazy"}
            width={640}
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50 px-3 text-center text-sm text-muted-foreground">
                {business.categories?.name ?? "Business"}
              </div>
            }
          />
        </Link>
        {SHOW_SAVED && (
          <div className="absolute left-2 top-2 z-30">
            <FavoriteButton businessId={business.id} size="sm" />
          </div>
        )}
        {tier >= AD_TIER && (
          <span
            data-ad-label
            className="pointer-events-none absolute right-2 top-2 z-30 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm"
          >
            Ad
          </span>
        )}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              data-photo-prev
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                go(-1);
              }}
              className="absolute left-1.5 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              data-photo-next
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                go(1);
              }}
              className="absolute right-1.5 top-1/2 z-30 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-foreground shadow hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 z-30 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
              {(index % photos.length) + 1}/{photos.length}
            </span>
          </>
        )}
      </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4 sm:pl-1">
        {/* Name + Verified + plan */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 title={business.name} className="min-w-0 break-words text-base font-semibold leading-snug text-foreground sm:text-lg">
            {business.name}
          </h3>
          {business.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-medium text-success-foreground">
              <BadgeCheck className="h-3 w-3" /> Verified
            </span>
          )}
          {tier >= 3 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">
              <Crown className="h-3 w-3" />
              {tier >= 5 ? "Enterprise" : tier === 4 ? "Platinum" : "Gold"}
            </span>
          )}
        </div>

        {(business.matchedHas?.length ?? 0) > 0 && (
          <p data-matched-has className="mt-1 line-clamp-2 text-sm text-foreground/80">
            <span className="font-semibold text-primary">Has:</span> {business.matchedHas!.join(", ")}
          </p>
        )}
        {(business.matchedIn?.length ?? 0) > 0 && (
          <p data-matched-in className="mt-1 line-clamp-1 text-sm text-foreground/80">
            <span className="font-semibold text-primary">In:</span> {business.matchedIn!.join(", ")}
          </p>
        )}

        {/* Rating, open / closed, distance */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
          {business.reviewCount === 0 ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">New</span>
          ) : business.reviewCount === undefined && business.avgRating === undefined ? null : (
            <span className="inline-flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded bg-rating/10 px-1.5 py-0.5 font-semibold text-rating">
                <Star className="h-3 w-3 fill-rating text-rating" />
                {(business.avgRating ?? 0).toFixed(1)}
              </span>
              <span className="text-muted-foreground">({business.reviewCount})</span>
            </span>
          )}
          {openState !== null && (
            <span className={`inline-flex items-center gap-1 font-medium ${openState ? "text-emerald-600" : "text-red-600"}`}>
              <Clock className="h-3.5 w-3.5" />
              {openState ? "Open now" : "Closed"}
            </span>
          )}
          {distance && (
            <span className="inline-flex items-center gap-1 text-muted-foreground" data-distance>
              <Navigation className="h-3.5 w-3.5" />
              {distanceFrom === "you" ? `${distance} away` : `${distance} from city centre`}
            </span>
          )}
        </div>

        {/* Category · city, address */}
        {place && <p className="mt-1.5 line-clamp-1 text-sm text-foreground/80">{place}</p>}
        {business.address && (
          <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground sm:text-sm">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{business.address}</span>
          </p>
        )}
        {preview && <p className="mt-1.5 hidden line-clamp-2 text-sm text-muted-foreground sm:block">{preview}</p>}

        {/* Tags: offer + a few services */}
        {(discountActive || (business.serviceTags?.length ?? 0) > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5" data-result-tags>
            {discountActive && diwali && (
              <span data-diwali-offer className="inline-flex items-center rounded-full bg-gradient-to-r from-amber-300 to-orange-400 px-2 py-0.5 text-[11px] font-bold text-[#5b2100]">
                {t("diwali.offerTag")}
              </span>
            )}
            {discountActive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ff6a00] px-2 py-0.5 text-[11px] font-bold text-white">
                <Tag className="h-3 w-3" />
                {business.app_discount_percent}% App Discount
              </span>
            )}
            {(business.serviceTags ?? []).map((s) => (
              <span key={s} className="max-w-[10rem] truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Buttons: one full-width row on phones */}
        <div className="relative z-20 mt-auto flex gap-2 pt-3.5">
          {business.phone ? (
            <a
              href={telHref(business.phone)}
              data-action="call"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:flex-none sm:px-5"
            >
              <Phone className="h-4 w-4" /> Call
            </a>
          ) : null}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              data-action="whatsapp"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 sm:flex-none sm:px-5"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <Link
            to="/business/$slug"
            params={{ slug: business.slug }}
            data-action="details"
            className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:flex-none sm:px-5"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Same shape as ResultCard, so the page does not jump when the real results arrive. */
export function ResultCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:flex-row">
      <div className="w-full shrink-0 sm:w-[16.5rem] sm:self-start sm:p-3 md:w-[17.5rem]">
        <Skeleton className="aspect-[4/3] w-full rounded-none sm:rounded-xl" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4 sm:pl-1">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-2 h-4 w-1/3" />
        <Skeleton className="mt-2 h-4 w-1/2" />
        <Skeleton className="mt-1.5 h-4 w-4/5" />
        <div className="mt-auto flex gap-2 pt-3.5">
          <Skeleton className="h-10 flex-1 sm:w-24 sm:flex-none" />
          <Skeleton className="h-10 flex-1 sm:w-28 sm:flex-none" />
          <Skeleton className="h-10 flex-1 sm:w-24 sm:flex-none" />
        </div>
      </div>
    </div>
  );
}
