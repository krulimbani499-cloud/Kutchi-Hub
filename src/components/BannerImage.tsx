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

// The widths asked for (Supabase resize, "contain": proportional, never cropped). The browser picks the smallest one that is sharp
// enough for the box and the screen's pixel density (`sizes` says how wide the box is), so a phone loads a small file and a big
// screen can ask for up to 2400 px. A resize never enlarges a picture beyond the uploaded file's own width.
const DESKTOP_WIDTHS = [1200, 1280, 1600, 2000, 2400];
const PHONE_WIDTHS = [600, 800, 1200]; // the phone picture (2:1), shown about 340px wide
const PHONE_MAIN_WIDTHS = [800, 1200]; // no phone picture: the main picture (3:1) shown whole in the phone box
// The box is the page container (see --container-7xl in styles.css) minus 32px of padding and the 2px border: from 768px on
// 100vw - 34px, but never narrower than 1246px once the screen is wider than the 1280px cap, and 2526px at the most.
const DESKTOP_SIZES = "min(100vw - 34px, max(1246px, 100vw - 98px), 2526px)";
const PHONE_SIZES = "calc(100vw - 18px)";

/** `url 1200w, url 1600w, ...`, or undefined when the picture cannot be resized (then the one address is used as it is). */
function widthSet(url: string, widths: number[]): string | undefined {
  if (resizedPublicUrl(url, widths[0]) === url) return undefined;
  return widths.map((w) => `${resizedPublicUrl(url, w)} ${w}w`).join(", ");
}

export function BannerImage({ banner }: { banner: BannerImageData; carouselHasMobile?: boolean }) {
  const hasMobile = !!banner.mobile_image_url;
  // If a resized picture fails to load, the originals are used (no resizing, no srcset).
  const [original, setOriginal] = useState(false);
  const desktopSet = original ? undefined : widthSet(banner.image_url, DESKTOP_WIDTHS);
  // With a phone picture: <source> for md and up (main picture) and the <img> for phones (phone picture). Without one, the one <img>
  // serves every screen, so its list holds the small and the big widths and `sizes` tells which box it is in.
  const phoneSet = original
    ? undefined
    : hasMobile
      ? widthSet(banner.mobile_image_url as string, PHONE_WIDTHS)
      : widthSet(banner.image_url, [...PHONE_MAIN_WIDTHS, ...DESKTOP_WIDTHS.filter((w) => w > PHONE_MAIN_WIDTHS[1])]);
  const phoneImgSizes = hasMobile ? PHONE_SIZES : `(min-width: 768px) ${DESKTOP_SIZES}, ${PHONE_SIZES}`;
  const desktop = original ? banner.image_url : resizedPublicUrl(banner.image_url, 1200);
  // Fallback address (no srcset support): the picture the phone would get.
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
        {hasMobile && <source media="(min-width: 768px)" srcSet={desktopSet ?? desktop} sizes={desktopSet ? DESKTOP_SIZES : undefined} />}
        <img
          src={phone}
          srcSet={phoneSet}
          sizes={phoneSet ? phoneImgSizes : undefined}
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
