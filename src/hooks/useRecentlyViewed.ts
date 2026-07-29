import { useEffect, useState } from "react";

export type RecentBusiness = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  category: string | null;
  featured_image: string | null;
  viewed_at: number;
};

const KEY = "kh:recently_viewed";
const MAX = 8;

function read(): RecentBusiness[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: RecentBusiness[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent("kh:recent-updated"));
  } catch {
    /* ignore quota errors */
  }
}

export function trackRecentlyViewed(b: Omit<RecentBusiness, "viewed_at">) {
  const list = read().filter((x) => x.id !== b.id);
  list.unshift({ ...b, viewed_at: Date.now() });
  write(list);
}

export function useRecentlyViewed() {
  const [list, setList] = useState<RecentBusiness[]>([]);
  useEffect(() => {
    setList(read());
    const onUpdate = () => setList(read());
    window.addEventListener("kh:recent-updated", onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener("kh:recent-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);
  return list;
}