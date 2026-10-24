// The picture box of a rotating marketing / category banner.
//
// Phones: ALWAYS a 2:1 box (a 1200 x 600 banner fills it exactly). md and up: the usual 3:1 box.
// The picture is never cropped (object-contain). Where its shape differs from the box (a 3:1 picture on a phone, a 2:1 picture
// on desktop) it is shown whole and centred over a soft blurred copy of itself, so there are no empty bars.
// Phones use mobile_image_url when the banner has one, otherwise the main image.

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

export function BannerImage({ banner }: { banner: BannerImageData; carouselHasMobile?: boolean }) {
  const hasMobile = !!banner.mobile_image_url;
  // Uploads are 1200 px wide and often 1 MB+. Ask for the sizes they are shown at (desktop 1200, phone 2x -> 800); the resize is
  // "contain" (proportional, never cropped). If a resized picture fails to load, the originals are used.
  const [original, setOriginal] = useState(false);
  const desktop = original ? banner.image_url : resizedPublicUrl(banner.image_url, 1200);
  // No mobile picture: the one <img> is used at every screen size, so it keeps the full 1200 px.
  const phone = original
    ? banner.mobile_image_url || banner.image_url
    : hasMobile
      ? resizedPublicUrl(banner.mobile_image_url as string, 800)
      : resizedPublicUrl(banner.image_url, 1200);
  const blurDesktop = resizedPublicUrl(banner.image_url, 200);
  const blurPhone = resizedPublicUrl(banner.mobile_image_url || banner.image_url, 200);
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted md:aspect-[3/1]">
      {/* Soft backdrop: only visible where the picture does not reach the edges. */}
      <picture aria-hidden className="absolute inset-0 block h-full w-full">
        {hasMobile && <source media="(min-width: 768px)" srcSet={blurDesktop} />}
        <img src={blurPhone} alt="" className="h-full w-full scale-125 object-cover opacity-70 blur-2xl" loading="lazy" decoding="async" />
      </picture>
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
