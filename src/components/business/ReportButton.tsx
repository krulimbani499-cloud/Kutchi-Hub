import { useState } from "react";
import { Flag } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { submitReport } from "@/lib/reports.functions";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";

interface ReportButtonProps {
  entityType: "business" | "review";
  entityId: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline";
}

export function ReportButton({ entityType, entityId, label = "Report", size = "sm", variant = "ghost" }: ReportButtonProps) {
  const { user } = useAuth();
  const report = useServerFn(submitReport);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    try {
      await report({ data: { entityType, entityId, reason: reason.trim() } });
      setDone(true);
      setReason("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDone(false); }}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="text-muted-foreground hover:text-destructive">
          <Flag className="mr-1 h-3.5 w-3.5" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {entityType}</DialogTitle>
        </DialogHeader>
        {!user ? (
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to report.
          </p>
        ) : done ? (
          <p className="text-sm text-muted-foreground">Thank you! Our team will review it.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
              placeholder="Why are you reporting this? (fake, spam, abusive, wrong info...)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px]"
              required
              minLength={3}
              maxLength={500}
            />
            <Button type="submit" disabled={submitting || reason.trim().length < 3} className="w-full">
              {submitting ? "Submitting..." : "Submit report"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
