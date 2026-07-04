import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ address: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      throw new Error("Google Maps connector is not configured");
    }

    const url = `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
      },
    });

    if (!res.ok) {
      throw new Error(`Geocoding failed: ${res.status}`);
    }

    const body = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };

    if (body.status !== "OK" || !body.results?.length) {
      return { found: false as const };
    }

    const top = body.results[0];
    return {
      found: true as const,
      formatted_address: top.formatted_address,
      latitude: top.geometry.location.lat,
      longitude: top.geometry.location.lng,
    };
  });