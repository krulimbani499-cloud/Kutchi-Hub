import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  BadgeCheck,
  Star,
  ThumbsUp,
  ExternalLink,
  MessageSquare,
  Navigation,
  Heart,
  Camera,
  Tag,
} from "lucide-react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BUSINESS_PHOTOS_BUCKET, SIGNED_BUSINESS_PHOTO_TTL_SECONDS, getBusinessPhotoStorageKey } from "@/lib/business-photos";
import { Instagram, Facebook, Youtube } from "lucide-react";
import { StarRating } from "./StarRating";
import { BusinessMap } from "./BusinessMap";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { telHref } from "@/lib/phone";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { addReview } from "@/lib/businesses.functions";
import { logBusinessEvent } from "@/lib/leads.functions";
import { listBusinessServices } from "@/lib/services.functions";
import { listBusinessProducts } from "@/lib/products.functions";
import { replyToReview, updateReview } from "@/lib/reviews.functions";
import { PhotoUploader } from "./PhotoUploader";
import { BlurFillImage } from "./BlurFillImage";
import { PhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";
import { FavoriteButton } from "./FavoriteButton";
import { EnquiryDialog } from "./EnquiryDialog";
import { ServicesManager, ServicesDisplay } from "./ServicesManager";
import { ProductsManager, ProductsDisplay } from "./ProductsManager";
import { ReportButton } from "./ReportButton";
import { RelatedBusinesses } from "./RelatedBusinesses";
import { ShareMenu } from "./ShareMenu";
import { trackRecentlyViewed } from "@/hooks/useRecentlyViewed";
import type { Tables } from "@/integrations/supabase/types";
import { isOpenNow } from "@/lib/business-hours";
import { AppDiscountCard } from "./AppDiscountCard";

interface BusinessDetailProps {
  business: Tables<"businesses"> & {
    categories: { id: string; name: string; slug: string; color: string | null; icon: string | null } | null;
    featured_image_url?: string | null;
    /** false = the business's plan does not include the catalog (hide "View catalog"). Missing = show, as before. */
    catalog_allowed?: boolean;
  };
  reviews: (Tables<"business_reviews"> & {
    profiles: { display_name: string | null; avatar_url: string | null } | null;
  })[];
  photos: Tables<"business_photos">[];
  avgRating: number;
  reviewCount: number;
}

export function BusinessDetail({ business, reviews, photos, avgRating, reviewCount }: BusinessDetailProps) {
  const { user } = useAuth();
  const router = useRouter();
  const submitReview = useServerFn(addReview);
  const editReview = useServerFn(updateReview);
  const logEvent = useServerFn(logBusinessEvent);
  const replyFn = useServerFn(replyToReview);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [editingMyReview, setEditingMyReview] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [replySaved, setReplySaved] = useState<Record<string, string>>({});
  const isOwner = !!user && user.id === business.owner_id;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const myReview = user ? reviews.find((r) => r.user_id === user.id) ?? null : null;

  const handleReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] ?? "").trim();
    if (!text) return;
    setReplyBusy(reviewId);
    try {
      await replyFn({ data: { reviewId, reply: text } });
      setReplySaved((s) => ({ ...s, [reviewId]: text }));
      setReplyDrafts((d) => ({ ...d, [reviewId]: "" }));
    } catch (err) {
      console.error(err);
    } finally {
      setReplyBusy(null);
    }
  };

  // Track profile view (once per mount)
  useEffect(() => {
    if (isOwner) return;
    logEvent({ data: { businessId: business.id, eventType: "view" } }).catch(() => {});
     
  }, [business.id, isOwner]);

  // Track in "Recently viewed" (localStorage) for all users
  useEffect(() => {
    trackRecentlyViewed({
      id: business.id,
      slug: business.slug,
      name: business.name,
      city: business.city ?? null,
      category: business.categories?.name ?? null,
      featured_image: business.featured_image ?? null,
    });
  }, [business.id, business.slug, business.name, business.city, business.categories?.name, business.featured_image]);

  const { data: services = [] } = useQuery({
    queryKey: ["services", business.id],
    queryFn: () => listBusinessServices({ data: { businessId: business.id } }),
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products", business.id],
    queryFn: () => listBusinessProducts({ data: { businessId: business.id } }),
  });

  const trackClick = (eventType: "call_click" | "whatsapp_click" | "website_click" | "direction_click" | "share_click") => {
    if (isOwner) return;
    logEvent({ data: { businessId: business.id, eventType } }).catch(() => {});
  };

  const hours = (business.hours as Record<string, string> | null) ?? {};
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const todayHours = hours[today];
  const isOpen = isOpenNow(business.hours) === true;
  const callNumbers = [business.phone, business.phone_secondary].filter((n): n is string => !!n);
  const addressLine = [business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ");
  const mapsHref = business.google_maps_url;
  // Cover first (the featured image, else the first photo), then the rest. The cover is added when it is not one of the
  // stored photos; it is never listed twice.
  const galleryPhotos = useMemo<LightboxPhoto[]>(() => {
    const keyOf = (u: string) => getBusinessPhotoStorageKey(u) ?? u;
    const all: LightboxPhoto[] = photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption }));
    const cover = business.featured_image;
    if (!cover) return all;
    const at = all.findIndex((p) => keyOf(p.url) === keyOf(cover));
    if (at === -1) return [{ id: "cover", url: cover, caption: null }, ...all];
    return [all[at], ...all.slice(0, at), ...all.slice(at + 1)];
  }, [photos, business.featured_image]);
  const coverSrc = business.featured_image_url ?? galleryPhotos[0]?.url ?? null;
  const discountActive =
    typeof business.app_discount_percent === "number" &&
    business.app_discount_percent > 0 &&
    (!business.app_discount_valid_until ||
      new Date(business.app_discount_valid_until) >= new Date(new Date().toDateString()));

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      if (myReview && editingMyReview) {
        await editReview({ data: { reviewId: myReview.id, rating, review: reviewText } });
        setMessage("Review updated!");
        setEditingMyReview(false);
      } else {
        await submitReview({ data: { businessId: business.id, rating, review: reviewText } });
        setMessage("Review submitted!");
      }
      setReviewText("");
      setRating(0);
      await router.invalidate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  const startEditMyReview = () => {
    if (!myReview) return;
    setRating(myReview.rating);
    setReviewText(myReview.review ?? "");
    setEditingMyReview(true);
    setMessage("");
  };

  const cancelEditMyReview = () => {
    setEditingMyReview(false);
    setRating(0);
    setReviewText("");
    setMessage("");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>›</span>
        {business.categories?.slug && (
          <>
            <Link to="/category/$slug" params={{ slug: business.categories.slug }} className="hover:text-foreground">
              {business.categories.name}
            </Link>
            <span>›</span>
          </>
        )}
        {business.city && (
          <>
            <Link
              to="/city/$slug"
              params={{ slug: business.city.toLowerCase().replace(/[^a-z0-9]+/g, "-") }}
              className="hover:text-foreground"
            >
              {business.city}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-foreground">{business.name}</span>
      </div>
      {/* legacy breadcrumb tail replaced above */}
      <div className="hidden">
        <span>›</span>
        <span className="text-foreground">{business.name}</span>
      </div>

      {/* JustDial-style hero card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Gallery: the cover picture only; every photo opens in the full-screen viewer. */}
          <div className="relative aspect-[4/3] bg-muted md:aspect-auto md:min-h-[22rem]">
            {discountActive && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-[#ff6a00] px-3 py-1.5 text-xs font-extrabold text-white shadow-lg ring-2 ring-white">
                <Tag className="h-3.5 w-3.5" />
                {business.app_discount_percent}% OFF
                <span className="hidden text-[10px] font-semibold opacity-90 sm:inline">
                  · App only
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setLightboxIndex(0)}
              className="absolute inset-0 block overflow-hidden bg-muted disabled:cursor-default"
              aria-label={galleryPhotos.length > 1 ? `Open all ${galleryPhotos.length} photos` : "Open photo"}
              disabled={galleryPhotos.length === 0}
            >
              {/* Whole picture over a blurred copy of itself: nothing cropped, no empty sides. */}
              <BlurFillImage
                src={coverSrc}
                alt={business.name}
                loading="eager"
                width={1200}
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-5xl font-bold text-primary">
                    {business.name.charAt(0)}
                  </div>
                }
              />
            </button>
            {galleryPhotos.length > 1 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white shadow-md backdrop-blur-sm transition-colors hover:bg-black/85"
              >
                <Camera className="h-3.5 w-3.5" /> View all {galleryPhotos.length} photos
              </button>
            )}
          </div>

          {lightboxIndex !== null && galleryPhotos.length > 0 && (
            <PhotoLightbox
              photos={galleryPhotos}
              index={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
              onIndexChange={setLightboxIndex}
            />
          )}

          {/* Summary panel */}
          <div className="flex min-w-0 flex-col justify-between gap-4 p-4 sm:p-6">
            <div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <h1 className="flex min-w-0 flex-wrap items-center gap-1.5 text-xl font-extrabold text-foreground sm:gap-2 sm:text-2xl">
                    {/* Full name, wrapping onto as many lines as it needs (never cut off). */}
                    <span className="min-w-0 max-w-full break-words">{business.name}</span>
                    {business.verified && (
                      <span className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 sm:px-2 sm:text-xs">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </h1>
                  <p className="mt-1 break-words text-xs text-muted-foreground sm:text-sm">
                    {business.categories?.name} · {business.city}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <FavoriteButton businessId={business.id} />
                  {reviewCount === 0 ? (
                    // No reviews yet: a "New" pill instead of "★ 0.0 / 0 Ratings".
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary sm:py-1 sm:text-sm">
                      New
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white sm:px-2 sm:py-1 sm:text-sm">
                        {avgRating.toFixed(1)} <Star className="h-3.5 w-3.5 fill-white" />
                      </span>
                      <span className="whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs">{reviewCount} Ratings</span>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-2 text-xs sm:text-sm">
                <div className="flex items-start gap-2 text-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />
                  <span className="min-w-0 break-words text-muted-foreground">{addressLine || "Address not provided"}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-[#ff6a00]" />
                  <span className={`font-semibold ${isOpen ? "text-green-600" : "text-red-600"}`}>
                    {isOpen ? "Open now" : "Closed"}
                  </span>
                  {todayHours && <span className="min-w-0 truncate text-muted-foreground">· {todayHours}</span>}
                </div>
              </div>
            </div>

            {/* Action buttons: a 2x2 grid, switching to one row of 4 only when the panel is wide enough (>= 32rem)
                for every label to fit. Never 3 + 1. */}
            <div className="@container">
            <div className="grid grid-cols-2 gap-2 @[32rem]:grid-cols-4">
              {callNumbers.length === 2 ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button className="h-10 min-w-0 bg-[#ff6a00] px-2 text-white hover:bg-[#e65a00] sm:h-11">
                      <Phone className="mr-1 h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap text-xs sm:text-sm">Call</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-56 p-1">
                    {callNumbers.map((n) => (
                      <a
                        key={n}
                        href={telHref(n)}
                        onClick={() => trackClick("call_click")}
                        className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                      >
                        <Phone className="h-4 w-4 shrink-0 text-[#ff6a00]" />
                        {n}
                      </a>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : callNumbers.length === 1 ? (
                <Button asChild className="h-10 min-w-0 bg-[#ff6a00] px-2 text-white hover:bg-[#e65a00] sm:h-11">
                  <a href={`tel:${callNumbers[0]}`} onClick={() => trackClick("call_click")} className="flex items-center justify-center">
                    <Phone className="mr-1 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs sm:text-sm">Call</span>
                  </a>
                </Button>
              ) : null}
              {business.phone && (
                <Button asChild variant="outline" className="h-10 min-w-0 border-green-600 px-2 text-green-700 hover:bg-green-50 sm:h-11">
                  <a
                    href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackClick("whatsapp_click")}
                    className="flex items-center justify-center"
                  >
                    <MessageSquare className="mr-1 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs sm:text-sm">WhatsApp</span>
                  </a>
                </Button>
              )}
              {mapsHref && (
                <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                  <a href={mapsHref} target="_blank" rel="noreferrer" onClick={() => trackClick("direction_click")} className="flex items-center justify-center">
                    <Navigation className="mr-1 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs sm:text-sm">Directions</span>
                  </a>
                </Button>
              )}
              {business.website ? (
                <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                  <a href={business.website} target="_blank" rel="noreferrer" onClick={() => trackClick("website_click")} className="flex items-center justify-center">
                    <Globe className="mr-1 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs sm:text-sm">Website</span>
                  </a>
                </Button>
              ) : business.email ? (
                <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                  <a href={`mailto:${business.email}`} className="flex items-center justify-center">
                    <Mail className="mr-1 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap text-xs sm:text-sm">Email</span>
                  </a>
                </Button>
              ) : null}
            </div>
            </div>

            {!isOwner && (
              <div className="pt-1">
                <AppDiscountCard business={business} />
                <EnquiryDialog
                  businessId={business.id}
                  businessName={business.name}
                  city={business.city}
                  defaultName={user ? undefined : ""}
                />
                <div className="mt-2">
                  <ReportButton entityType="business" entityId={business.id} label="Report listing" />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              {business.website && (
                <a href={business.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <div className="ml-auto">
                <ShareMenu
                  title={business.name}
                  text={`${business.name} — ${business.categories?.name ?? "Business"}${business.city ? " in " + business.city : ""} on Kutchi Hub`}
                  onShare={() => trackClick("share_click")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
            {/* Empty sections are left out of the public page: no "No description / services / products / photos" placeholders. */}
            {business.description && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">About</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{business.description}</p>
              </section>
            )}

            {/* Catalog (PDF): only when there is one and the plan includes it. */}
            {business.catalog_url && business.catalog_allowed !== false && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">Catalog</h2>
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-orange-50 text-[#ff6a00]">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground">{business.catalog_name || "Product catalog"}</p>
                    <p className="text-xs text-muted-foreground">PDF</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-[#ff6a00] text-white hover:bg-[#e65a00]"
                    onClick={async () => {
                      const key = getBusinessPhotoStorageKey(business.catalog_url);
                      if (!key) return;
                      const { data } = await supabase.storage
                        .from(BUSINESS_PHOTOS_BUCKET)
                        .createSignedUrl(key, SIGNED_BUSINESS_PHOTO_TTL_SECONDS);
                      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
                    }}
                  >
                    View catalog
                  </Button>
                </div>
              </section>
            )}

            {/* Services / Products: the public sees a section only when the owner switched it on AND it has at least one item.
                A missing switch (the section-toggles SQL is not applied yet) counts as on, as before. The owner always gets the manager. */}
            {(isOwner || (business.show_services !== false && services.length > 0)) && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">Services</h2>
                {isOwner ? (
                  <ServicesManager businessId={business.id} visibleOnProfile={business.show_services !== false} />
                ) : (
                  <ServicesDisplay services={services} />
                )}
              </section>
            )}

            {(isOwner || (business.show_products !== false && products.length > 0)) && (
              <section>
                <h2 className="mb-2 text-lg font-semibold text-foreground">Products</h2>
                {isOwner ? (
                  <ProductsManager businessId={business.id} visibleOnProfile={business.show_products !== false} />
                ) : (
                  <ProductsDisplay products={products} />
                )}
              </section>
            )}

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Location & Hours</h2>
              <div className="mb-4">
                <BusinessMap googleMapsUrl={business.google_maps_url} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{[business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ")}</span>
                  </div>
                  {business.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{business.phone}</span>
                    </div>
                  )}
                  {business.phone_secondary && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0" />
                      <span>{business.phone_secondary}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                    <div key={day} className={`flex justify-between ${day === today ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      <span className="capitalize">{day}</span>
                      <span>{hours[day] ?? "Closed"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Photo gallery + upload (owner only) */}
          {(isOwner || photos.length > 0) && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Photos</h2>
              <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
            </div>
            {isOwner ? (
              <PhotoUploader
                businessId={business.id}
                featuredImage={business.featured_image}
                initialPhotos={photos}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <div className="aspect-square w-full">
                      <BlurFillImage
                        src={photo.url}
                        alt={photo.caption ?? "Business photo"}
                        loading="lazy"
                        width={480}
                        imgClassName="transition-transform hover:scale-105"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            {/* No reviews yet: no "Reviews" heading and no "No reviews yet" text, just the write-a-review action. */}
            <h2 className="mb-4 text-lg font-semibold text-foreground">{reviews.length > 0 ? "Reviews" : "Write a review"}</h2>
            {user && (!myReview || editingMyReview) ? (
              <form onSubmit={handleReview} className="mb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{editingMyReview ? "Edit your rating:" : "Your rating:"}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`h-6 w-6 ${star <= rating ? "fill-rating text-rating" : "text-muted-foreground"}`}
                      >
                        <Star className="h-5 w-5" />
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea
                  placeholder="Write your review..."
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  className="min-h-[80px]"
                />
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={rating === 0 || submitting} className="bg-primary text-primary-foreground">
                    {submitting ? "Saving..." : editingMyReview ? "Update Review" : "Submit Review"}
                  </Button>
                  {editingMyReview && (
                    <Button type="button" variant="ghost" onClick={cancelEditMyReview}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            ) : !user ? (
              <div className="mb-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link> to write a review.
              </div>
            ) : (
              <div className="mb-6 flex items-center justify-between gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <span>You've already reviewed this business.</span>
                <Button size="sm" variant="outline" onClick={startEditMyReview}>Edit your review</Button>
              </div>
            )}

            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        {(review.profiles?.display_name ?? "U").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-foreground">{review.profiles?.display_name ?? "User"}</span>
                    </div>
                    <StarRating rating={review.rating} showValue={false} />
                  </div>
                  {review.review && <p className="mt-1 text-sm text-muted-foreground">{review.review}</p>}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="h-3 w-3" />
                    <span>{review.helpful_count} found helpful</span>
                    {user && user.id !== review.user_id && (
                      <div className="ml-auto">
                        <ReportButton entityType="review" entityId={review.id} label="Report" />
                      </div>
                    )}
                  </div>
                  {(replySaved[review.id] ?? review.owner_reply) && (
                    <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/40 p-3">
                      <div className="text-xs font-semibold text-primary">Owner reply</div>
                      <p className="mt-1 text-sm text-foreground">
                        {replySaved[review.id] ?? review.owner_reply}
                      </p>
                    </div>
                  )}
                  {isOwner && !(replySaved[review.id] ?? review.owner_reply) && (
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Reply as owner..."
                        value={replyDrafts[review.id] ?? ""}
                        onChange={(e) =>
                          setReplyDrafts((d) => ({ ...d, [review.id]: e.target.value }))
                        }
                        className="min-h-[60px]"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReply(review.id)}
                        disabled={replyBusy === review.id || !(replyDrafts[review.id] ?? "").trim()}
                      >
                        {replyBusy === review.id ? "Posting..." : "Post reply"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-80">
          <div className="sticky top-20 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-foreground">Quick Info</h3>
            <div className="space-y-3 text-sm">
              {business.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={`tel:${business.phone}`} className="text-foreground hover:underline">{business.phone}</a>
                </div>
              )}
              {business.phone_secondary && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 shrink-0" />
                  <a href={telHref(business.phone_secondary)} className="text-foreground hover:underline">{business.phone_secondary}</a>
                </div>
              )}
              {business.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0" />
                  <a href={`mailto:${business.email}`} className="text-foreground hover:underline">{business.email}</a>
                </div>
              )}
              {business.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0" />
                  <a href={business.website} target="_blank" rel="noreferrer" className="text-foreground hover:underline">{business.website}</a>
                </div>
              )}
              {(business.instagram_url || business.facebook_url || business.youtube_url) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {business.instagram_url && (
                    <a
                      href={business.instagram_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Instagram"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 text-white transition-transform hover:scale-110"
                    >
                      <Instagram className="h-4 w-4" />
                    </a>
                  )}
                  {business.facebook_url && (
                    <a
                      href={business.facebook_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="Facebook"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#1877F2] text-white transition-transform hover:scale-110"
                    >
                      <Facebook className="h-4 w-4" />
                    </a>
                  )}
                  {business.youtube_url && (
                    <a
                      href={business.youtube_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      aria-label="YouTube"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#FF0000] text-white transition-transform hover:scale-110"
                    >
                      <Youtube className="h-4 w-4" />
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground">{hours[today] ?? "Closed today"}</span>
              </div>
            </div>
            <div className="mt-4">
              <BusinessMap googleMapsUrl={business.google_maps_url} />
            </div>
          </div>
        </aside>
      </div>
      <RelatedBusinesses
        businessId={business.id}
        categoryId={business.categories?.id ?? null}
        city={business.city ?? null}
      />
    </div>
  );
}
