// The picture box of a rotating marketing / category banner.
//
// md and up: always the main image in a 3:1 box (unchanged).
// Phones, no banner in the carousel has a mobile image: the same 3:1 box (unchanged).
// Phones, at least one banner in the carousel has a mobile (2:1) image: the whole carousel uses a 2:1 box so
//   it does not jump between slides. A slide with a mobile image fills it; a 3:1-only slide is shown whole
//   and centred over a soft blurred copy of itself. Nothing is ever cropped (object-contain on the picture).

import { useState } from "react";
import { markResizeBroken, resizedPublicUrl } from "@/components/business/BusinessPhotoImage";

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
  // The uploads are 1200 x 400 / 1200 x 600 and often 1 MB+. They are shown at most ~1200 px wide (desktop) or ~400 px (phone,
  // 2x screens -> 800): ask for those sizes. If a resized picture fails to load, the originals are used.
  const [original, setOriginal] = useState(false);
  const desktop = original ? banner.image_url : resizedPublicUrl(banner.image_url, 1200);
  // No mobile picture: the one <img> is used at every screen size, so it keeps the full 1200 px.
  const phone = original
    ? banner.mobile_image_url || banner.image_url
    : hasMobile
      ? resizedPublicUrl(banner.mobile_image_url as string, 800)
      : resizedPublicUrl(banner.image_url, 1200);
  return (
    <div
      className={`relative w-full overflow-hidden bg-muted ${
        carouselHasMobile ? "aspect-[2/1] md:aspect-[3/1]" : "aspect-[3/1]"
      }`}
    >
      {carouselHasMobile && !hasMobile && (
        // Phones only: soft background so a 3:1 slide in a 2:1 box has no empty bars.
        <img
          src={resizedPublicUrl(banner.image_url, 200)}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl md:hidden"
        />
      )}
      <picture className="relative block h-full w-full">
        {hasMobile && <source media="(min-width: 768px)" srcSet={desktop} />}
        <img
          src={phone}
          alt={banner.title}
          className="h-full w-full object-contain transition-opacity duration-500"
          loading="lazy"
          decoding="async"
          onError={() => {
            if (!original) {
              markResizeBroken();
              setOriginal(true);
            }
          }}
        />
      </picture>
    </div>
  );
}
