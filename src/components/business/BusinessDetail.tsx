import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Mail, Globe, Clock, BadgeCheck, Star, ThumbsUp, ExternalLink } from "lucide-react";
import { StarRating } from "./StarRating";
import { BusinessMap } from "./BusinessMap";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { addReview } from "@/lib/businesses.functions";
import type { Tables } from "@/integrations/supabase/types";

interface BusinessDetailProps {
  business: Tables<"businesses"> & {
    categories: { id: string; name: string; slug: string; color: string | null; icon: string | null } | null;
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
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const hours = (business.hours as Record<string, string> | null) ?? {};
  const today = new Date().toLocaleDateString("en-US", { weekday: "short" }).toLowerCase();

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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link to="/search" search={{ category: business.categories?.slug }} className="hover:text-foreground">
          {business.categories?.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{business.name}</span>
      </div>

      <div className="relative h-48 overflow-hidden rounded-2xl bg-muted sm:h-64">
        {business.featured_image ? (
          <img src={business.featured_image} alt={business.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-muted text-2xl font-bold text-primary">
            {business.name}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{business.name}</h1>
                {business.verified && (
                  <BadgeCheck className="h-5 w-5 text-success" />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {business.categories?.name} · {business.city}
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center gap-1 text-rating">
                <Star className="h-4 w-4 fill-rating" />
                <span className="font-bold">{avgRating.toFixed(1)}</span>
              </div>
              <span className="text-sm text-muted-foreground">({reviewCount} reviews)</span>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {business.phone && (
              <Button className="bg-primary text-primary-foreground" asChild>
                <a href={`tel:${business.phone}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call Now
                </a>
              </Button>
            )}
            {business.email && (
              <Button variant="outline" asChild>
                <a href={`mailto:${business.email}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
            )}
            {business.website && (
              <Button variant="outline" asChild>
                <a href={business.website} target="_blank" rel="noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                  Website
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/business/$slug/claim" params={{ slug: business.slug }}>
                Claim this business
              </Link>
            </Button>
          </div>

          <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
            <section>
              <h2 className="mb-2 text-lg font-semibold text-foreground">About</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{business.description || "No description available."}</p>
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
