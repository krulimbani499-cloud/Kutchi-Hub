import { useState } from "react";
import { MapPin, LocateFixed, Check, ChevronDown } from "lucide-react";
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
import { INDIAN_CITIES } from "@/lib/cities";
import { useCity } from "@/hooks/useCity";
import { getCurrentLocation, reverseGeocode, extractCity } from "@/lib/geolocation";
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

  async function detect() {
    setDetecting(true);
    try {
      const loc = await getCurrentLocation();
      const rg = await reverseGeocode(loc.latitude, loc.longitude);
      // Prefer any address field that matches our known cities list (so a
      // suburb like "Hanspura" wins over the parent city "Ahmedabad").
      const candidates = [
        rg.address.suburb,
        rg.address.village,
        rg.address.town,
        rg.address.city,
      ].filter(Boolean) as string[];
      const knownMatch = candidates
        .map((c) => INDIAN_CITIES.find((k) => k.toLowerCase() === c.toLowerCase()))
        .find(Boolean);
      const detected = knownMatch ?? extractCity(rg);
      if (!detected) {
        toast.error("Couldn't detect city from your location");
        return;
      }
      setCity(detected);
      toast.success(`Location set to ${detected}`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to detect location");
    } finally {
      setDetecting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <Command>
          <CommandInput placeholder="Search city..." />
          <CommandList>
            <CommandEmpty>No matching city.</CommandEmpty>
            <CommandGroup heading="Cities">
              {INDIAN_CITIES.map((c) => (
                <CommandItem
                  key={c}
                  value={c}
                  onSelect={() => {
                    setCity(c);
                    setOpen(false);
                  }}
                >
                  {c}
                  {city === c && <Check className="ml-auto h-4 w-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}