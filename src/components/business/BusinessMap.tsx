import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessMapProps {
  googleMapsUrl?: string | null;
}

export function BusinessMap({ googleMapsUrl }: BusinessMapProps) {
  if (!googleMapsUrl) return null;

  return (
    <Button asChild size="sm" className="rounded-full bg-[#ff6a00] text-white hover:bg-[#e65a00]">
      <a href={googleMapsUrl} target="_blank" rel="noreferrer">
        <Navigation className="mr-1.5 h-3.5 w-3.5" /> Get Directions
      </a>
    </Button>
  );
}
