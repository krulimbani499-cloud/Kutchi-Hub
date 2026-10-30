import { useMemo, useState } from "react";
import { seededRandom, shuffleByPriority, type OrderableBanner } from "@/lib/banner-rules";

/**
 * The banners of a carousel in fair rotation order for THIS page view: higher priority first, the same priority in random order
 * (never by date). The order is decided once per page view (a seed picked when the carousel first appears) and does not change on
 * re-renders, carousel ticks or when the same banners are fetched again, only on the next visit / reload.
 *
 * `keepOrder`: the banners were already put in random order on the server and are part of the server-rendered page (the
 * city x category page): they are shown exactly as they came, so the first banner never changes after the page appears.
 * Banners that are fetched in the browser (home, category and search pages) are shuffled here, the moment they arrive; nothing
 * was drawn before, so there is nothing to jump.
 */
export function useShuffledBanners<T extends OrderableBanner>(banners: readonly T[], keepOrder = false): T[] {
  // One seed per appearance of the carousel. Only used for banners that are not part of the server-rendered page.
  const [seed] = useState(() => Math.floor(Math.random() * 0x100000000));
  return useMemo(() => (keepOrder ? [...banners] : shuffleByPriority(banners, seededRandom(seed))), [banners, keepOrder, seed]);
}
