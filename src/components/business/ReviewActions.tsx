import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EyeOff, Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { reportReview, type ReviewReportReason } from "@/lib/review-moderation.functions";

const REASONS: { value: ReviewReportReason; label: string; hint: string }[] = [
  { value: "spam", label: "Spam", hint: "Advertising or links that have nothing to do with this business" },
  { value: "abusive", label: "Abusive", hint: "Insults, threats or hateful language" },
  { value: "fake", label: "Fake", hint: "Not a real customer experience" },
  { value: "other", label: "Something else", hint: "Tell us more below" },
];

/**
 * The two actions under every review written by someone else (App Store guideline 1.2):
 *  - Report: pick a reason (spam / abusive / fake / other), goes to the admin "Reported reviews" list.
 *  - Hide reviews from this user: only for this viewer, takes effect immediately.
 * Signed-out visitors are asked to sign in.
 */
export function ReviewActions({ reviewId, authorId, onHideUser }: { reviewId: string; authorId: string; onHideUser: (userId: string) => Promise<void> }) {
  const { user } = useAuth();
  const report = useServerFn(reportReview);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReviewReportReason | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [hiding, setHiding] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      await report({ data: { reviewId, reason, details: details.trim() || undefined } });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const hideUser = async () => {
    setHiding(true);
    try {
      await onHideUser(authorId);
      toast.success("Reviews from this user are hidden for you.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not hide. Please try again.");
      setHiding(false);
    }
  };

  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) {
      setDone(false);
      setReason("");
      setDetails("");
      setError("");
    }
  };

  return (
    <div className="ml-auto flex items-center gap-1">
      <Dialog open={open} onOpenChange={reset}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive">
            <Flag className="mr-1 h-3.5 w-3.5" />
            Report
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report this review</DialogTitle>
            <DialogDescription>Our team checks every report and hides reviews that break the rules.</DialogDescription>
          </DialogHeader>
          {!user ? (
            <p className="text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to report a review.
            </p>
          ) : done ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Thank you. Our team will look at this review.</p>
              <Button variant="outline" className="w-full" onClick={() => { void hideUser(); reset(false); }} disabled={hiding}>
                <EyeOff className="mr-2 h-4 w-4" /> Also hide reviews from this user
              </Button>
              <Button className="w-full" onClick={() => reset(false)}>Done</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <RadioGroup value={reason} onValueChange={(v) => setReason(v as ReviewReportReason)} className="gap-2">
                {REASONS.map((r) => (
                  <Label
                    key={r.value}
                    htmlFor={`rr-${reviewId}-${r.value}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 font-normal"
                  >
                    <RadioGroupItem id={`rr-${reviewId}-${r.value}`} value={r.value} className="mt-0.5" />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{r.label}</span>
                      <span className="block text-xs text-muted-foreground">{r.hint}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <Textarea
                placeholder="More details (optional)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="min-h-[70px]"
                maxLength={500}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy || !reason} className="w-full">
                {busy ? "Sending..." : "Submit report"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {user && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={hideUser}
          disabled={hiding}
          title="Hide all reviews from this user"
        >
          <EyeOff className="mr-1 h-3.5 w-3.5" />
          Hide user
        </Button>
      )}
    </div>
  );
}
