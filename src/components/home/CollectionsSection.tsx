import { Link } from "@tanstack/react-router";

type Item = { label: string; emoji: string; slug: string; bg: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Wedding Requisites",
    items: [
      { label: "Banquet Halls", emoji: "🏛️", slug: "banquet-halls", bg: "from-amber-100 to-amber-200" },
      { label: "Bridal Requisite", emoji: "👰", slug: "bridal", bg: "from-rose-100 to-rose-200" },
      { label: "Caterers", emoji: "🍽️", slug: "caterers", bg: "from-orange-100 to-orange-200" },
    ],
  },
  {
    title: "Beauty & Spa",
    items: [
      { label: "Beauty Parlours", emoji: "💅", slug: "beauty", bg: "from-pink-100 to-pink-200" },
      { label: "Spa & Massages", emoji: "💆", slug: "spa", bg: "from-emerald-100 to-emerald-200" },
      { label: "Salons", emoji: "💇", slug: "salon", bg: "from-fuchsia-100 to-fuchsia-200" },
    ],
  },
  {
    title: "Repairs & Services",
    items: [
      { label: "AC Service", emoji: "❄️", slug: "ac-service", bg: "from-sky-100 to-sky-200" },
      { label: "Car Service", emoji: "🚗", slug: "car-service", bg: "from-blue-100 to-blue-200" },
      { label: "Bike Service", emoji: "🏍️", slug: "bike-service", bg: "from-slate-100 to-slate-200" },
    ],
  },
  {
    title: "Daily Needs",
    items: [
      { label: "Movies", emoji: "🎬", slug: "movies", bg: "from-indigo-100 to-indigo-200" },
      { label: "Grocery", emoji: "🛒", slug: "grocery", bg: "from-yellow-100 to-yellow-200" },
      { label: "Electricians", emoji: "🔌", slug: "electricians", bg: "from-lime-100 to-lime-200" },
    ],
  },
];

export function CollectionsSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="grid gap-4 md:grid-cols-2">
        {GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-2xl border border-border bg-background p-5 shadow-sm"
          >
            <h3 className="mb-4 text-base font-bold text-foreground">{group.title}</h3>
            <div className="grid grid-cols-3 gap-3">
              {group.items.map((item) => (
                <Link
                  key={item.slug}
                  to="/search"
                  search={{ category: item.slug }}
                  className="group flex flex-col items-center gap-2 text-center"
                >
                  <div
                    className={`flex aspect-square w-full items-center justify-center rounded-xl bg-gradient-to-br ${item.bg} text-4xl transition-transform group-hover:-translate-y-0.5 sm:text-5xl`}
                  >
                    <span aria-hidden>{item.emoji}</span>
                  </div>
                  <span className="text-xs font-medium text-foreground sm:text-sm">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}