import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/listing-completeness";

/** My Listings: the plan of a quick-listing business is active, so the owner can fill in the rest. Hidden once everything is done. */
export function CompleteDetailsBanner({ planName, slug, checklist }: { planName: string | null; slug: string; checklist: ChecklistItem[] }) {
  const remaining = checklist.filter((c) => !c.done).length;
  if (remaining === 0) return null;
  return (
    <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-950 sm:p-5">
      <p className="font-semibold leading-snug">
        Your {planName ?? "plan"} plan is active - complete your business details
      </p>
      <p className="mt-1 text-sm text-green-900/80">
        {remaining} of {checklist.length} still to do. Your listing goes live once the Kutchi Hub team has checked it.
      </p>
      <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
        {checklist.map((c) => (
          <li key={c.key} className={`flex items-center gap-2 ${c.done ? "text-green-800" : "text-foreground"}`}>
            {c.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className={c.done ? "line-through opacity-70" : ""}>{c.label}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" className="mt-3 bg-[#ff6a00] text-white hover:bg-[#e65a00]">
        <Link to="/business/$slug/edit" params={{ slug }}>Complete details</Link>
      </Button>
    </div>
  );
}
