import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { matchLocalCities, otherPlaces, usePickPlace, usePlaceSearch, useBusinessCities } from "@/hooks/usePlaces";
import type { PlaceSuggestion } from "@/lib/places";

type Option = { key: string; label: string; secondary?: string; group: "Kutchi Hub cities" | "Other places"; pick: () => void };

/**
 * City text field with suggestions: our own list first, then Google (towns and villages), so a new business
 * city is spelled the way Google spells it. Anything can still be typed freely.
 */
export function CityAutocomplete({
  id,
  value,
  onChange,
  required,
}: {
  id?: string;
  value: string;
  onChange: (city: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picking, setPicking] = useState(false);
  // Suggestions follow what the user types, not a value that was just picked.
  const [typed, setTyped] = useState("");
  const businessCities = useBusinessCities();
  const search = usePlaceSearch(typed, open);
  const pickPlace = usePickPlace();
  const box = useRef<HTMLDivElement>(null);

  const local = matchLocalCities(typed, businessCities, 6);
  const other = otherPlaces(search.places, local);

  function done(city: string) {
    onChange(city);
    setTyped("");
    setOpen(false);
    setActive(-1);
    search.resetSession();
  }

  async function pickGoogle(place: PlaceSuggestion) {
    setPicking(true);
    try {
      const { city } = await pickPlace(place, search.sessionToken());
      done(city);
    } finally {
      setPicking(false);
    }
  }

  const options: Option[] = [
    ...local.map<Option>((c) => ({
      key: `local-${c.city}`,
      label: c.city,
      secondary: c.count > 0 ? `${c.count} ${c.count === 1 ? "business" : "businesses"}` : undefined,
      group: "Kutchi Hub cities",
      pick: () => done(c.city),
    })),
    ...other.map<Option>((p) => ({
      key: p.placeId,
      label: p.name,
      secondary: p.secondary,
      group: "Other places",
      pick: () => void pickGoogle(p),
    })),
  ];
  const showList = open && typed.trim().length >= 2 && (options.length > 0 || search.loading);

  return (
    <div
      ref={box}
      className="relative"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <Input
        id={id}
        value={value}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            options[active]?.pick();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-popover py-1 text-popover-foreground shadow-md"
        >
          {options.map((o, i) => (
            <li key={o.key} role="presentation">
              {(i === 0 || options[i - 1].group !== o.group) && (
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">{o.group}</p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                // mousedown (not click) so the input does not lose focus and close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  o.pick();
                }}
                className={`flex w-full flex-col px-3 py-1.5 text-left text-sm hover:bg-accent ${i === active ? "bg-accent" : ""}`}
              >
                <span className="truncate">{o.label}</span>
                {o.secondary && <span className="truncate text-xs text-muted-foreground">{o.secondary}</span>}
              </button>
            </li>
          ))}
          {search.loading && options.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching...
            </li>
          )}
          {picking && <li className="px-3 py-1 text-xs text-muted-foreground">Selecting...</li>}
        </ul>
      )}
    </div>
  );
}
