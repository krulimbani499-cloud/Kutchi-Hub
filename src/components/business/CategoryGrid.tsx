import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";

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

function pickEmoji(icon: string | null, slug: string, name?: string) {
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

interface CategoryGridProps {
  categories: Tables<"categories">[];
  size?: "sm" | "md";
}

export function CategoryGrid({ categories, size = "md" }: CategoryGridProps) {
  const sizeClasses =
    size === "sm"
      ? "grid-cols-2 sm:grid-cols-3"
      : "grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10";

  return (
    <div className={`grid gap-3 ${sizeClasses}`}>
      {categories.map((category) => {
        const iconUrl = (category as unknown as { icon_url?: string | null }).icon_url;
        const emoji = pickEmoji(category.icon, category.slug, category.name);
        return (
          <Link
            key={category.id}
            to="/search"
            search={{ category: category.slug }}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-orange-100/60 text-3xl leading-none">
              {iconUrl ? (
                <img src={iconUrl} alt="" className="h-10 w-10 object-contain" />
              ) : (
                <span aria-hidden>{emoji}</span>
              )}
            </div>
            <span className="text-xs font-medium text-foreground leading-tight whitespace-nowrap">{category.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
