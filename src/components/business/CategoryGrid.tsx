import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { useT } from "@/lib/i18n";
import { SafeImage } from "./SafeImage";
import { markResizeBroken, resizedPublicUrl } from "./BusinessPhotoImage";

// Colorful emoji icons in JustDial style — mapped by icon key or category slug/name.
const emojiMap: Record<string, string> = {
  utensils: "🍽️",
  restaurants: "🍽️",
  bed: "🏨",
  hotels: "🏨",
  stethoscope: "🩺",
  doctors: "🩺",
  hospitals: "🏥",
  "graduation-cap": "🎓",
  education: "🎓",
  "driving-schools": "🚗",
  "shopping-cart": "🛒",
  shopping: "🛍️",
  scissors: "💇",
  salon: "💇",
  "beauty-spa": "💆",
  beauty: "💆",
  landmark: "🏦",
  banks: "🏦",
  loans: "💰",
  car: "🚙",
  cars: "🚙",
  home: "🏠",
  "home-decor": "🛋️",
  "real-estate": "🏡",
  "estate-agent": "🏘️",
  "pg-hostels": "🛏️",
  dumbbell: "🏋️",
  gym: "🏋️",
  dentists: "🦷",
  wedding: "💍",
  "wedding-planning": "💍",
  "rent-hire": "🔑",
  "event-organisers": "🎉",
  events: "🎉",
  "packers-movers": "🚚",
  repairs: "🔧",
  b2b: "🤝",
};

// Keyword-based fallback: any new category name/slug containing these words
// gets an appropriate icon automatically.
const keywordMap: Array<[RegExp, string]> = [
  [/restaur|food|dhaba|cafe|dine|eatery|kitchen|tiffin|thali|canteen/, "🍽️"],
  [/pizza|burger|fastfood|fast-food/, "🍔"],
  [/bakery|cake|sweet|mithai|dessert|ice.?cream/, "🍰"],
  [/tea|chai|coffee/, "☕"],
  [/juice|drink|beverage/, "🥤"],
  [/grocery|kirana|supermarket|mart|store/, "🛒"],
  [/hotel|resort|lodge|stay|guest.?house|pg|hostel/, "🏨"],
  [/hospital|clinic|medical|nursing/, "🏥"],
  [/doctor|physician|physio|therap/, "🩺"],
  [/dentist|dental/, "🦷"],
  [/pharma|chemist|medicine|drug/, "💊"],
  [/lab|diagnostic|pathology|xray|x-ray|scan/, "🧪"],
  [/eye|optical|optician/, "👓"],
  [/vet|pet|animal/, "🐾"],
  [/school|college|coaching|tuition|academy|institute|educat|classes|tutor/, "🎓"],
  [/library|book/, "📚"],
  [/driving/, "🚗"],
  [/car|auto|garage|mechanic|vehicle|bike|motor|scooter/, "🚙"],
  [/taxi|cab|rental/, "🚕"],
  [/bus|travel|tour|trip|holiday/, "🚌"],
  [/train|railway/, "🚆"],
  [/flight|airline|airport/, "✈️"],
  [/petrol|fuel|pump|gas/, "⛽"],
  [/salon|parlour|parlor|barber|haircut/, "💇"],
  [/spa|beauty|makeup|cosmet/, "💆"],
  [/gym|fitness|yoga|workout/, "🏋️"],
  [/sport|cricket|football|game/, "⚽"],
  [/bank|atm|finance|loan|insur|invest|mutual|stock/, "🏦"],
  [/law|legal|advoc|court|notary/, "⚖️"],
  [/tax|ca |accountant|charter|audit/, "🧾"],
  [/real.?estate|property|builder|constructi|architect|interior|decor/, "🏡"],
  [/rent|hire|lease/, "🔑"],
  [/packer|mover|logistic|courier|transport|cargo|shipping/, "🚚"],
  [/repair|plumb|electric|carpenter|mason|paint|technic|service/, "🔧"],
  [/wedding|marriage|bride|groom/, "💍"],
  [/event|party|catering|dj|banquet|hall/, "🎉"],
  [/photo|videograph|studio/, "📷"],
  [/print|xerox|stationer/, "🖨️"],
  [/cloth|garment|apparel|boutique|tailor|fashion|saree|dress/, "👗"],
  [/shoe|footwear/, "👟"],
  [/jewel|gold|silver|diamond/, "💎"],
  [/electronic|mobile|phone|computer|laptop|gadget/, "📱"],
  [/appliance|ac |refriger|washing|kitchen/, "🔌"],
  [/furniture|sofa|home.?decor/, "🛋️"],
  [/gift|florist|flower/, "💐"],
  [/toy|kids|baby|child/, "🧸"],
  [/temple|church|mosque|religious|astrolog|pandit/, "🛕"],
  [/farm|agri|crop|dairy|milk/, "🌾"],
  [/water|purifier|ro /, "💧"],
  [/security|cctv|guard/, "🛡️"],
  [/media|news|advertis|marketing|design|print/, "📰"],
  [/it |software|web|digital|tech/, "💻"],
  [/b2b|whole.?sale|manufactur|industr|factory/, "🏭"],
  [/ngo|charity|trust|social/, "🤝"],
  [/govern|municip|office/, "🏛️"],
];

// Shared with the home "Popular Searches" row, so both show the same emoji for a category without an image.
export function pickEmoji(icon: string | null, slug: string, name?: string) {
  const direct =
    emojiMap[icon ?? ""] ??
    emojiMap[slug] ??
    emojiMap[slug.replace(/[^a-z0-9]+/g, "-")];
  if (direct) return direct;

  const haystack = `${slug} ${(name ?? "").toLowerCase()} ${(icon ?? "").toLowerCase()}`;
  for (const [pattern, emoji] of keywordMap) {
    if (pattern.test(haystack)) return emoji;
  }
  return "📍";
}

/** `businessCount` is only set where the grid should show "N businesses" (home Popular Categories). */
type GridCategory = Tables<"categories"> & { businessCount?: number };

interface CategoryGridProps {
  categories: GridCategory[];
  size?: "sm" | "md";
}

/** The uploaded icon, or the emoji when there is no icon or the image fails to load. */
function CategoryTileIcon({ category, imgClassName = "h-10 w-10" }: { category: Tables<"categories">; imgClassName?: string }) {
  const iconUrl = (category as unknown as { icon_url?: string | null }).icon_url?.trim() || null;
  // Remember WHICH url failed, so a changed url is tried again.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [resizedFailed, setResizedFailed] = useState(false);
  if (iconUrl && failedUrl !== iconUrl) {
    // Shown at 40 px: a 120 px copy instead of the original (up to 350 KB each, 27 of them = 5 MB on a phone).
    const shown = resizedFailed ? iconUrl : resizedPublicUrl(iconUrl, 120);
    return (
      <SafeImage
        src={shown}
        className={`${imgClassName} object-contain`}
        onFail={() => {
          if (!resizedFailed && shown !== iconUrl) {
            markResizeBroken();
            setResizedFailed(true);
          } else {
            setFailedUrl(iconUrl);
          }
        }}
      />
    );
  }
  return <span aria-hidden>{pickEmoji(category.icon, category.slug, category.name)}</span>;
}

export function CategoryGrid({ categories, size = "md" }: CategoryGridProps) {
  const t = useT();
  const hasCounts = categories.some((c) => c.businessCount !== undefined);
  const sizeClasses =
    size === "sm"
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8";

  return (
    <div className={`grid gap-3 ${sizeClasses}`}>
      {categories.map((category) => {
        return (
          <Link
            key={category.id}
            to="/search"
            search={{ category: category.slug }}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md sm:p-4"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/60 text-3xl leading-none">
              <CategoryTileIcon category={category} />
            </div>
            {/* Up to 2 lines, never cut with "…". min-h reserves both lines so every tile has the same height. */}
            <span
              title={category.name}
              className="line-clamp-2 min-h-[2.5em] w-full break-words text-xs font-medium leading-tight text-foreground sm:text-sm"
            >
              {category.name}
            </span>
            {category.businessCount !== undefined ? (
              <span className="-mt-1 w-full truncate text-[11px] leading-tight text-muted-foreground">
                {category.businessCount} {category.businessCount === 1 ? t("home.business1") : t("home.businessN")}
              </span>
            ) : (
              // Tiles without a number (city fill-ins) keep the line's height so the grid stays even.
              hasCounts && <span aria-hidden className="-mt-1 text-[11px] leading-tight">&nbsp;</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * One small tile for the home "Popular Categories" row: icon + name (and the number of businesses). Smaller than a business card.
 * On a phone the count is just the number (the tile is about 66px wide); from md up it reads "12 businesses".
 */
export function CategoryTile({ category }: { category: GridCategory }) {
  const t = useT();
  const n = category.businessCount;
  const label = n !== undefined ? `${n} ${n === 1 ? t("home.business1") : t("home.businessN")}` : null;
  return (
    <Link
      to="/search"
      search={{ category: category.slug }}
      title={label ? `${category.name} - ${label}` : category.name}
      className="group flex w-full min-w-0 flex-col items-center gap-1 rounded-xl p-0.5 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/60 text-2xl leading-none transition-transform group-hover:scale-105 sm:h-12 sm:w-12 md:h-14 md:w-14 md:text-3xl">
        <CategoryTileIcon category={category} imgClassName="h-8 w-8 md:h-10 md:w-10" />
      </div>
      {/* Up to 2 lines; min-h keeps every tile the same height. */}
      <span className="line-clamp-2 min-h-[2.4em] w-full text-[10.5px] font-medium leading-tight text-foreground [overflow-wrap:anywhere] sm:text-xs md:text-sm">
        {category.name}
      </span>
      {label !== null && (
        <span className="-mt-0.5 w-full truncate text-[10px] leading-tight text-muted-foreground md:text-[11px]">
          <span className="md:hidden">{n}</span>
          <span className="hidden md:inline">{label}</span>
        </span>
      )}
    </Link>
  );
}

/** The last tile of the row: opens the A-Z categories page. */
export function CategoriesViewAllTile() {
  const t = useT();
  return (
    <Link
      to="/categories"
      className="group flex w-full min-w-0 flex-col items-center gap-1 rounded-xl p-0.5 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary transition-transform group-hover:scale-105 sm:h-12 sm:w-12 md:h-14 md:w-14">
        <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
      </div>
      <span className="line-clamp-2 min-h-[2.4em] w-full text-[10.5px] font-semibold leading-tight text-primary sm:text-xs md:text-sm">{t("home.viewAll")}</span>
    </Link>
  );
}
