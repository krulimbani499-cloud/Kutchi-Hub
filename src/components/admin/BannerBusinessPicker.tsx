import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchesSearch } from "@/lib/list-search";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export type BannerBusinessOption = { id: string; name: string; city: string; enterprise: boolean };

const MAX_SHOWN = 60;

/**
 * Searchable dropdown of published businesses ("Name · City"). Picking one reports the whole option, so the form can fill
 * the title and city. `selectedLabel` is shown when the chosen business is not in the list (e.g. it was archived since).
 */
export function BannerBusinessPicker({
  options,
  value,
  selectedLabel,
  onPick,
  onClear,
}: {
  options: BannerBusinessOption[];
  value: string | null;
  selectedLabel?: string | null;
  onPick: (option: BannerBusinessOption) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const query = useDebouncedValue(text, 120);
  const selected = options.find((o) => o.id === value) ?? null;
  const shown = useMemo(
    () => options.filter((o) => matchesSearch(query, { text: [o.name, o.city] })),
    [options, query],
  );
  const label = selected ? `${selected.name} · ${selected.city}` : selectedLabel ?? null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setText(""); }}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-9 min-w-0 flex-1 justify-between px-3 font-normal">
            <span className={`truncate ${label ? "text-foreground" : "text-muted-foreground"}`}>{label ?? "Search a published business…"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,26rem)] p-2">
          <Input autoFocus type="search" placeholder="Business name or city" value={text} onChange={(e) => setText(e.target.value)} className="mb-2 h-9" />
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {shown.slice(0, MAX_SHOWN).map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => { onPick(o); setOpen(false); }}
                >
                  <Check className={`h-4 w-4 shrink-0 ${o.id === value ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {o.name} <span className="text-muted-foreground">· {o.city || "no city"}</span>
                  </span>
                  {o.enterprise && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Enterprise</span>}
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-2 py-3 text-center text-sm text-muted-foreground">No published business found</li>}
            {shown.length > MAX_SHOWN && (
              <li className="px-2 py-2 text-center text-xs text-muted-foreground">Showing {MAX_SHOWN} of {shown.length}. Type more to narrow it down.</li>
            )}
          </ul>
        </PopoverContent>
      </Popover>
      {value && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onClear} aria-label="Remove business">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
