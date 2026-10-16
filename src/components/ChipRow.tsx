import { cn } from "@/lib/utils";

export type Chip<T extends string> = { value: T; label: string; count?: number };

/** A row of single-choice chips. On a phone it scrolls sideways inside itself (the page never does); on lg+ it wraps. */
export function ChipRow<T extends string>({
  chips,
  value,
  onChange,
  label,
}: {
  chips: Chip<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex min-w-0 gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-wrap lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const active = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/50",
            )}
          >
            {chip.label}
            {chip.count !== undefined && (
              <span className={cn("text-xs tabular-nums", active ? "opacity-90" : "text-muted-foreground")}>{chip.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
