// "Ahmedabad · Naroda": a place inside a city. When someone picks a locality (Naroda, Bopal, Shela, Kathwada ...) the businesses
// of its PARENT city are shown, nearest to the picked place first. Pure functions (no browser, no database), so the rules can be
// tested on their own. The business cities (the cities that have published businesses) are passed in by the caller.
import { CITIES_BY_STATE } from "./cities";
import { cleanPlaceName, normalizeToListedCity, resolveDetectedCity } from "./geolocation";
import type { GeocodeCandidates } from "./geocode";

/** What a pick turns into: the city whose businesses are shown, and the picked locality (null = no locality involved). */
export type ResolvedPlace = { city: string; area: string | null };

/** The business city (a city with published businesses) a place name stands for, in the spelling the businesses use; else null. */
export function businessCityFor(name: string | null | undefined, district: string | null, businessCities: readonly string[]): string | null {
  const raw = name?.trim();
  if (!raw) return null;
  const hit = normalizeToListedCity(raw, district, [...businessCities]);
  if (!hit) return null;
  // The spelling aliases (Dehgam -> Dahegam) can point at a city that has no business: it only counts when it has.
  const key = cleanPlaceName(hit);
  return businessCities.find((c) => cleanPlaceName(c) === key) ?? null;
}

/** "Kathwada GIDC, Odhav Industrial Estate, Odhav" -> "Kathwada GIDC": the name of a picked suggestion. */
export const placeMainName = (text: string): string => text.split(",")[0].trim() || text.trim();

/**
 * A place the person picked (typed list, Google suggestion):
 *   1. businesses exist with city = the place itself: that city (today's behaviour, no area);
 *   2. else the parent city, read from Google's `locality` component (or, when the place is itself tagged as the locality, as
 *      Shela is, from its district), when that parent has businesses: the parent city, the picked place is the "area";
 *   3. else null: the caller keeps the place as the city, and the "nearest cities" card does the rest.
 * `district` is the administrative_area_level_3 of the place (Ahmedabad), `locality` its `locality` component.
 */
export function resolvePick(o: {
  picked: string;
  district: string | null;
  locality: string | null;
  businessCities: readonly string[];
}): ResolvedPlace | null {
  const name = placeMainName(o.picked);
  const own = businessCityFor(name, o.district, o.businessCities);
  if (own) return { city: own, area: null };
  const pickedKey = cleanPlaceName(name);
  for (const parentName of [o.locality, o.district]) {
    const parent = businessCityFor(parentName, null, o.businessCities);
    if (parent && cleanPlaceName(parent) !== pickedKey) return { city: parent, area: name };
  }
  return null;
}

/**
 * "Use my location": Google's place names around the device, most specific first. Same rule:
 *   1. the first name that is itself a business city wins (a business in "Naroda" itself beats "Ahmedabad"); a more specific name
 *      before it becomes the area (a listed suburb first, else the widest one);
 *   2. else the district, when it is a business city (the area is the widest local name);
 *   3. else the old behaviour (resolveDetectedCity): the most specific listed place or the town, no area.
 */
export function resolveDetectedPlace(
  place: Pick<GeocodeCandidates, "district" | "localNames" | "locality" | "fallback" | "names" | "suburb">,
  listedCities: string[],
  businessCities: readonly string[],
): ResolvedPlace | null {
  const listed = new Set(listedCities.map(cleanPlaceName));
  const names = place.localNames;
  // The area: a listed place among the more specific names (Naroda), else Google's suburb (Satellite), else the locality itself
  // (Shela is tagged as one); never a house society or the city itself.
  const areaFor = (city: string, moreSpecific: string[]): string | null => {
    const notCity = (n: string | null) => (n && cleanPlaceName(n) !== cleanPlaceName(city) ? n : null);
    return moreSpecific.find((n) => listed.has(cleanPlaceName(n))) ?? notCity(place.suburb) ?? notCity(place.locality) ?? null;
  };
  for (let i = 0; i < names.length; i++) {
    const hit = businessCityFor(names[i], place.district, businessCities);
    if (hit) return { city: hit, area: i === 0 ? null : areaFor(hit, names.slice(0, i)) };
  }
  const byDistrict = businessCityFor(place.district, null, businessCities);
  if (byDistrict) return { city: byDistrict, area: areaFor(byDistrict, names) };
  const city = resolveDetectedCity(place, listedCities);
  return city ? { city, area: null } : null;
}

/** The state of an entry of the typed city list ("Bopal" -> "Gujarat"), to look the right place up; null when it is not listed. */
export function stateOfListedCity(name: string): string | null {
  const key = cleanPlaceName(name);
  for (const g of CITIES_BY_STATE) if (g.cities.some((c) => cleanPlaceName(c) === key)) return g.state;
  return null;
}

// ---- the "In Naroda" tag

const GENERIC_TAIL = /\s+(gidc|industrial\s+(?:estate|area)|gam|village)$/i;

/** The words to look for in an address: "Kathwada GIDC" -> "Kathwada" (addresses write it both ways). */
export function areaSearchName(area: string): string {
  const base = area.replace(/\s+/g, " ").trim();
  const short = base.replace(GENERIC_TAIL, "").trim();
  return short.length >= 3 ? short : base;
}

/** Does this address mention the area? Whole words, any case ("Nava Naroda" and "Naroda GIDC" both mention Naroda). */
export function mentionsArea(address: string | null | undefined, area: string | null | undefined): boolean {
  if (!address || !area) return false;
  const name = areaSearchName(area);
  if (!name) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
  return re.test(address);
}

/** The header label: "Ahmedabad · Naroda". */
export const cityLabel = (city: string, area?: string | null): string => (area ? `${city} · ${area}` : city);
