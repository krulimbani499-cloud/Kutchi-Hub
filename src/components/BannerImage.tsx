// The picture box of a rotating marketing / category banner.
//
// md and up: always the main image in a 3:1 box (unchanged).
// Phones, no banner in the carousel has a mobile image: the same 3:1 box (unchanged).
// Phones, at least one banner in the carousel has a mobile (2:1) image: the whole carousel uses a 2:1 box so
//   it does not jump between slides. A slide with a mobile image fills it; a 3:1-only slide is shown whole
//   and centred over a soft blurred copy of itself. Nothing is ever cropped (object-contain on the picture).

export type BannerImageData = {
  image_url: string;
  mobile_image_url?: string | null;
  title: string;
};

export function bannerCarouselHasMobileImage(banners: Array<{ mobile_image_url?: string | null }>): boolean {
  return banners.some((b) => !!b.mobile_image_url);
}

export function BannerImage({ banner, carouselHasMobile }: { banner: BannerImageData; carouselHasMobile: boolean }) {
  const hasMobile = !!banner.mobile_image_url;
  return (
    <div
      className={`relative w-full overflow-hidden bg-muted ${
        carouselHasMobile ? "aspect-[2/1] md:aspect-[3/1]" : "aspect-[3/1]"
      }`}
    >
      {carouselHasMobile && !hasMobile && (
        // Phones only: soft background so a 3:1 slide in a 2:1 box has no empty bars.
        <img
          src={banner.image_url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl md:hidden"
        />
      )}
      <picture className="relative block h-full w-full">
        {hasMobile && <source media="(min-width: 768px)" srcSet={banner.image_url} />}
        <img
          src={banner.mobile_image_url || banner.image_url}
          alt={banner.title}
          className="h-full w-full object-contain transition-opacity duration-500"
          loading="lazy"
        />
      </picture>
    </div>
  );
}
