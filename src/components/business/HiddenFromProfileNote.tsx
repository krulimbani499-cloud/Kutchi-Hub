import { EyeOff } from "lucide-react";

/** Shown above a Services / Products manager while that section's switch is off: the owner can still prepare items. */
export function HiddenFromProfileNote() {
  return (
    <p
      role="note"
      data-hidden-from-profile
      className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
    >
      <EyeOff className="h-3.5 w-3.5 shrink-0" /> Hidden from your public profile
    </p>
  );
}
