import { useEffect, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
  X,
  Tag,
} from "lucide-react";
import { StarRating } from "./StarRating";
import { BusinessMap } from "./BusinessMap";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { addReview } from "@/lib/businesses.functions";
import { logBusinessEvent } from "@/lib/leads.functions";
import { listBusinessServices } from "@/lib/services.functions";
import { listBusinessProducts } from "@/lib/products.functions";
import { replyToReview, updateReview } from "@/lib/reviews.functions";
import { PhotoUploader } from "./PhotoUploader";
import { BusinessPhotoImage } from "./BusinessPhotoImage";
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
  const addressLine = [business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ");
  const mapsHref = business.latitude != null && business.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name + " " + addressLine)}`;
  const galleryPhotos = photos.slice(0, 4);
  const featuredImageSrc = business.featured_image_url ?? business.featured_image;
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
          {/* Gallery */}
          <div className="relative bg-muted">
            {discountActive && (
              <div className="pointer-events-none absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-[#ff6a00] px-3 py-1.5 text-xs font-extrabold text-white shadow-lg ring-2 ring-white">
                <Tag className="h-3.5 w-3.5" />
                {business.app_discount_percent}% OFF
                <span className="hidden text-[10px] font-semibold opacity-90 sm:inline">
                  · App only
                </span>
              </div>
            )}
            <div className="grid h-56 grid-cols-2 grid-rows-1 gap-1 sm:h-80 sm:grid-cols-4 sm:grid-rows-2">
              <button
                type="button"
                onClick={() => photos.length > 0 && setLightboxIndex(0)}
                className="relative col-span-2 row-span-1 overflow-hidden bg-muted sm:row-span-2"
                aria-label="Open photo gallery"
                disabled={photos.length === 0 && !featuredImageSrc}
              >
                {featuredImageSrc ? (
                  <BusinessPhotoImage src={featuredImageSrc} alt={business.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-2xl font-bold text-primary">
                    {business.name.charAt(0)}
                  </div>
                )}
              </button>
              {[0, 1, 2, 3].map((i) => {
                const p = galleryPhotos[i];
                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => p && setLightboxIndex(i)}
                    disabled={!p}
                    className="relative hidden overflow-hidden bg-muted sm:block disabled:cursor-default"
                    aria-label={p ? `View photo ${i + 1}` : "No photo"}
                  >
                    {p ? (
                      <>
                        <BusinessPhotoImage src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                        {i === 3 && photos.length > 4 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                            +{photos.length - 4} more
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Camera className="h-5 w-5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => setLightboxIndex(0)}
                className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-black/85"
              >
                <Camera className="mr-1 inline h-3.5 w-3.5" /> {photos.length} Photos
              </button>
            )}
          </div>

          {lightboxIndex !== null && photos.length > 0 && (
            <PhotoLightbox
              photos={photos}
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
                    <span className="min-w-0 truncate">{business.name}</span>
                    {business.verified && (
                      <span className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200 sm:px-2 sm:text-xs">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </h1>
                  <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm">
                    {business.categories?.name} · {business.city}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <FavoriteButton businessId={business.id} />
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-1.5 py-0.5 text-xs font-bold text-white sm:px-2 sm:py-1 sm:text-sm">
                    {avgRating.toFixed(1)} <Star className="h-3.5 w-3.5 fill-white" />
                  </span>
                  <span className="max-w-16 truncate text-[11px] text-muted-foreground sm:max-w-none sm:text-xs">{reviewCount} Ratings</span>
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

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {business.phone && (
                <Button asChild className="h-10 min-w-0 bg-[#ff6a00] px-2 text-white hover:bg-[#e65a00] sm:h-11">
                  <a href={`tel:${business.phone}`} onClick={() => trackClick("call_click")} className="flex items-center justify-center">
                    <Phone className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-xs sm:text-sm">Call</span>
                  </a>
                </Button>
              )}
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
                    <span className="truncate text-xs sm:text-sm">WhatsApp</span>
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                <a href={mapsHref} target="_blank" rel="noreferrer" onClick={() => trackClick("direction_click")} className="flex items-center justify-center">
                  <Navigation className="mr-1 h-4 w-4 shrink-0" />
                  <span className="truncate text-xs sm:text-sm">Directions</span>
                </a>
              </Button>
              {business.website ? (
                <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                  <a href={business.website} target="_blank" rel="noreferrer" onClick={() => trackClick("website_click")} className="flex items-center justify-center">
                    <Globe className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-xs sm:text-sm">Website</span>
                  </a>
                </Button>
              ) : business.email ? (
                <Button asChild variant="outline" className="h-10 min-w-0 px-2 sm:h-11">
                  <a href={`mailto:${business.email}`} className="flex items-center justify-center">
                    <Mail className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-xs sm:text-sm">Email</span>
                  </a>
                </Button>
              ) : null}
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
            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">About</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{business.description || "No description available."}</p>
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Services</h2>
              {isOwner ? (
                <ServicesManager businessId={business.id} />
              ) : services.length > 0 ? (
                <ServicesDisplay services={services} />
              ) : (
                <p className="text-sm text-muted-foreground">No services listed.</p>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Products</h2>
              {isOwner ? (
                <ProductsManager businessId={business.id} />
              ) : products.length > 0 ? (
                <ProductsDisplay products={products} />
              ) : (
                <p className="text-sm text-muted-foreground">No products listed.</p>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">Location & Hours</h2>
              <div className="mb-4">
                <BusinessMap
                  lat={business.latitude}
                  lng={business.longitude}
                  name={business.name}
                  address={[business.address, business.city, business.state].filter(Boolean).join(", ")}
                />
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
            ) : photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-lg border border-border"
                  >
                    <BusinessPhotoImage
                      src={photo.url}
                      alt={photo.caption ?? "Business photo"}
                      loading="lazy"
                      className="aspect-square w-full object-cover transition-transform hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No photos yet.</p>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Reviews</h2>
            {user ? (
              <form onSubmit={handleReview} className="mb-6 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Your rating:</span>
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
                <Button type="submit" disabled={rating === 0 || submitting} className="bg-primary text-primary-foreground">
                  {submitting ? "Submitting..." : "Submit Review"}
                </Button>
              </form>
            ) : (
              <div className="mb-6 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link> to write a review.
              </div>
            )}

            <div className="space-y-4">
              {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet. Be the first to review!</p>}
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
                  <p className="mt-1 text-sm text-muted-foreground">{review.review || "No written review."}</p>
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
              <div className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground">{hours[today] ?? "Closed today"}</span>
              </div>
            </div>
            <div className="mt-4">
              <BusinessMap
                lat={business.latitude}
                lng={business.longitude}
                name={business.name}
                address={[business.address, business.city].filter(Boolean).join(", ")}
              />
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

function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: Tables<"business_photos">[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const total = photos.length;
  const current = photos[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % total);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [index, total, onClose, onIndexChange]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index - 1 + total) % total);
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onIndexChange((index + 1) % total);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
      <div
        className="relative flex max-h-[90vh] max-w-[92vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <BusinessPhotoImage
          src={current.url}
          alt={current.caption ?? `Photo ${index + 1}`}
          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        />
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
        {index + 1} / {total}
      </div>
    </div>
  );
}
