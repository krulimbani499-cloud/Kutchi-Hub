import { useState } from "react";
import { MapPin, LocateFixed, Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CITIES_BY_STATE, INDIAN_CITIES } from "@/lib/cities";
import { useCity } from "@/hooks/useCity";
import { matchLocalCities, otherPlaces, usePickPlace, usePlaceSearch, useBusinessCities } from "@/hooks/usePlaces";
import { getCurrentLocation, resolveDetectedCity, LOCATION_UNAVAILABLE } from "@/lib/geolocation";
import { reverseGeocodeCity } from "@/lib/maps.functions";
import type { PlaceSuggestion } from "@/lib/places";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CitySelectorProps {
  className?: string;
  compact?: boolean;
}

export function CitySelector({ className, compact }: CitySelectorProps) {
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const businessCities = useBusinessCities();
  const search = usePlaceSearch(query, open);
  const pickPlace = usePickPlace();

  const typed = query.trim();
  const local = typed ? matchLocalCities(typed, businessCities) : [];
  const other = typed.length >= 2 ? otherPlaces(search.places, local) : [];

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      search.resetSession();
    }
  }

  function choose(name: string, coords?: { lat: number; lng: number } | null) {
    setCity(name, coords);
    handleOpenChange(false);
  }

  async function choosePlace(place: PlaceSuggestion) {
    setPicking(true);
    try {
      // Place details give the district (so "Vadagam" in Aravalli keeps matching our listing) and the
      // coordinates (used to suggest nearby cities when this place has no businesses yet).
      const { city: picked, coords } = await pickPlace(place, search.sessionToken());
      choose(picked, coords);
    } finally {
      setPicking(false);
    }
  }

  async function detect() {
    setDetecting(true);
    try {
      const loc = await getCurrentLocation();
      // Google lookup runs on the server (the key never reaches the browser).
      const place = await reverseGeocodeCity({ data: { lat: loc.latitude, lng: loc.longitude } });
      // The most specific place Google returns (a listed suburb or village first, else the town or village
      // itself), with the spelling aliases and the Vadagam district rule applied.
      const detected = resolveDetectedCity(place, INDIAN_CITIES);
      if (!detected) {
        toast.error(LOCATION_UNAVAILABLE);
        setOpen(true);
        return;
      }
      choose(detected, { lat: loc.latitude, lng: loc.longitude });
      toast.success(`Location set to ${detected}`);
    } catch {
      toast.error(LOCATION_UNAVAILABLE);
      setOpen(true);
    } finally {
      setDetecting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "sm" : "default"}
          className={cn(
            "gap-1.5 font-medium text-foreground hover:bg-accent",
            className,
          )}
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className={compact ? "max-w-[9ch] truncate" : "max-w-[14ch] truncate"}>
            {city ?? "Select city"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b border-border p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={detect}
            disabled={detecting}
          >
            <LocateFixed className={cn("h-4 w-4", detecting && "animate-pulse")} />
            {detecting ? "Detecting..." : "Use my location"}
          </Button>
        </div>
        {/* shouldFilter off: we filter ourselves (aliases, businesses first) and add Google's results. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search any town or village..." value={query} onValueChange={setQuery} />
          <CommandList className={cn(picking && "pointer-events-none opacity-60")}>
            {typed ? (
              <>
                {local.length > 0 && (
                  <CommandGroup heading="Kutchi Hub cities">
                    {local.map((c) => (
                      <CommandItem key={`local-${c.city}`} value={`local-${c.city}`} onSelect={() => choose(c.city)}>
                        {c.city}
                        {c.count > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.count} {c.count === 1 ? "business" : "businesses"}
                          </span>
                        )}
                        {city === c.city && <Check className="ml-auto h-4 w-4 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {other.length > 0 && (
                  <CommandGroup heading="Other places">
                    {other.map((p) => (
                      <CommandItem key={p.placeId} value={`place-${p.placeId}`} onSelect={() => void choosePlace(p)}>
                        <div className="min-w-0">
                          <div className="truncate">{p.name}</div>
                          {p.secondary && <div className="truncate text-xs text-muted-foreground">{p.secondary}</div>}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {search.loading && local.length + other.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : (
                  local.length + other.length === 0 && <CommandEmpty>No matching place.</CommandEmpty>
                )}
              </>
            ) : (
              <>
                {businessCities.length > 0 && (
                  <CommandGroup heading="Kutchi Hub cities">
                    {businessCities.map((c) => (
                      <CommandItem key={`biz-${c.city}`} value={`biz-${c.city}`} onSelect={() => choose(c.city)}>
                        {c.city}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c.count} {c.count === 1 ? "business" : "businesses"}
                        </span>
                        {city === c.city && <Check className="ml-auto h-4 w-4 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {CITIES_BY_STATE.map((group) => (
                  <CommandGroup key={group.state} heading={group.state}>
                    {group.cities.map((c) => (
                      <CommandItem key={c} value={`list-${group.state}-${c}`} onSelect={() => choose(c)}>
                        {c}
                        {city === c && <Check className="ml-auto h-4 w-4 text-primary" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
