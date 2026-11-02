export const BANNER_IMAGES_BUCKET = "banner-images";
export const BANNER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BANNER_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
// Main (desktop) image: 3:1. Recommended 2400 x 800 (sharp on big screens); anything exactly 3:1 and at least 1200 x 400 is accepted.
export const BANNER_IMAGE_WIDTH = 2400;
export const BANNER_IMAGE_HEIGHT = 800;
export const BANNER_IMAGE_MIN_WIDTH = 1200;
export const BANNER_IMAGE_MIN_HEIGHT = 400;
// Optional phone version: taller, 2:1. Same bucket and size limit as the main image.
export const BANNER_MOBILE_IMAGE_WIDTH = 1200;
export const BANNER_MOBILE_IMAGE_HEIGHT = 600;
