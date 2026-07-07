import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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
  Share2,
  Heart,
  Camera,
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
import { replyToReview } from "@/lib/reviews.functions";
import { PhotoUploader } from "./PhotoUploader";
import { BusinessPhotoImage } from "./BusinessPhotoImage";
import { FavoriteButton } from "./FavoriteButton";
import { EnquiryDialog } from "./EnquiryDialog";
import { ServicesManager, ServicesDisplay } from "./ServicesManager";
import { ReportButton } from "./ReportButton";
import type { Tables } from "@/integrations/supabase/types";

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
  const submitReview = useServerFn(addReview);
  const logEvent = useServerFn(logBusinessEvent);
  const replyFn = useServerFn(replyToReview);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusy, setReplyBusy] = useState<string | null>(null);
  const [replySaved, setReplySaved] = useState<Record<string, string>>({});
  const isOwner = !!user && user.id === business.owner_id;

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

  const { data: services = [] } = useQuery({
    queryKey: ["services", business.id],
    queryFn: () => listBusinessServices({ data: { businessId: business.id } }),
  });

  const trackClick = (eventType: "call_click" | "whatsapp_click" | "website_click" | "direction_click" | "share_click") => {
    if (isOwner) return;
    logEvent({ data: { businessId: business.id, eventType } }).catch(() => {});
  };

  const hours = (business.hours as Record<string, string> | null) ?? {};
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();
  const todayHours = hours[today];
  const isOpen = !!todayHours && todayHours.toLowerCase() !== "closed";
  const addressLine = [business.address, business.city, business.state, business.pincode].filter(Boolean).join(", ");
  const mapsHref = business.latitude != null && business.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business.name + " " + addressLine)}`;
  const galleryPhotos = photos.slice(0, 4);
  const featuredImageSrc = business.featured_image_url ?? business.featured_image;

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      await submitReview({ data: { businessId: business.id, rating, review: reviewText } });
      setReviewText("");
      setRating(0);
      setMessage("Review submitted!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>›</span>
        <Link to="/search" search={{ category: business.categories?.slug }} className="hover:text-foreground">
          {business.categories?.name}
        </Link>
        <span>›</span>
        <span className="text-foreground">{business.name}</span>
      </div>

      {/* JustDial-style hero card */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Gallery */}
          <div className="relative bg-muted">
            <div className="grid h-56 grid-cols-2 grid-rows-1 gap-1 sm:h-80 sm:grid-cols-4 sm:grid-rows-2">
              <div className="relative col-span-2 row-span-1 overflow-hidden bg-muted sm:row-span-2">
                {featuredImageSrc ? (
                  <BusinessPhotoImage src={featuredImageSrc} alt={business.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-50 text-2xl font-bold text-primary">
                    {business.name.charAt(0)}
                  </div>
                )}
              </div>
              {[0, 1, 2, 3].map((i) => {
                const p = galleryPhotos[i];
                return (
                  <div key={i} className="relative hidden overflow-hidden bg-muted sm:block">
                    {p ? (
                      <BusinessPhotoImage src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                        <Camera className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {photos.length > 0 && (
              <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                <Camera className="mr-1 inline h-3.5 w-3.5" /> {photos.length} Photos
              </div>
            )}
          </div>

          {/* Summary panel */}
          <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-foreground">
                    <span className="truncate">{business.name}</span>
                    {business.verified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                        <BadgeCheck className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {business.categories?.name} · {business.city}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <FavoriteButton businessId={business.id} />
                  <span className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-sm font-bold text-white">
                    {avgRating.toFixed(1)} <Star className="h-3.5 w-3.5 fill-white" />
                  </span>
                  <span className="text-xs text-muted-foreground">{reviewCount} Ratings</span>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-start gap-2 text-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />
                  <span className="text-muted-foreground">{addressLine || "Address not provided"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-[#ff6a00]" />
                  <span className={`font-semibold ${isOpen ? "text-green-600" : "text-red-600"}`}>
                    {isOpen ? "Open now" : "Closed"}
                  </span>
                  {todayHours && <span className="text-muted-foreground">· {todayHours}</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {business.phone && (
                <Button asChild className="h-11 min-w-0 bg-[#ff6a00] px-2 text-white hover:bg-[#e65a00]">
                  <a href={`tel:${business.phone}`} onClick={() => trackClick("call_click")} className="flex items-center justify-center">
                    <Phone className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">Call</span>
                  </a>
                </Button>
              )}
              {business.phone && (
                <Button asChild variant="outline" className="h-11 min-w-0 border-green-600 px-2 text-green-700 hover:bg-green-50">
                  <a
                    href={`https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackClick("whatsapp_click")}
                    className="flex items-center justify-center"
                  >
                    <MessageSquare className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">WhatsApp</span>
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="h-11 min-w-0 px-2">
                <a href={mapsHref} target="_blank" rel="noreferrer" onClick={() => trackClick("direction_click")} className="flex items-center justify-center">
                  <Navigation className="mr-1 h-4 w-4 shrink-0" />
                  <span className="truncate text-sm">Directions</span>
                </a>
              </Button>
              {business.website ? (
                <Button asChild variant="outline" className="h-11 min-w-0 px-2">
                  <a href={business.website} target="_blank" rel="noreferrer" onClick={() => trackClick("website_click")} className="flex items-center justify-center">
                    <Globe className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">Website</span>
                  </a>
                </Button>
              ) : business.email ? (
                <Button asChild variant="outline" className="h-11 min-w-0 px-2">
                  <a href={`mailto:${business.email}`} className="flex items-center justify-center">
                    <Mail className="mr-1 h-4 w-4 shrink-0" />
                    <span className="truncate text-sm">Email</span>
                  </a>
                </Button>
              ) : null}
            </div>

            {!isOwner && (
              <div className="pt-1">
                <EnquiryDialog
                  businessId={business.id}
                  businessName={business.name}
                  city={business.city}
                  defaultName={user ? undefined : ""}
                />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
              {business.website && (
                <a href={business.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                  <Globe className="h-3.5 w-3.5" /> Website <ExternalLink className="h-3 w-3" />
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  trackClick("share_click");
                  if (typeof navigator !== "undefined" && "share" in navigator) {
                    navigator.share({ title: business.name, url: window.location.href }).catch(() => {});
                  }
                }}
                className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
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
                  </div>
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
    </div>
  );
}
