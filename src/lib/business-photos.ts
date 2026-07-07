export const BUSINESS_PHOTOS_BUCKET = "business-photos";
export const SIGNED_BUSINESS_PHOTO_TTL_SECONDS = 60 * 60 * 24;

export function getBusinessPhotoStorageKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const bucketPrefix = `${BUSINESS_PHOTOS_BUCKET}/`;
  if (trimmed.startsWith(bucketPrefix)) {
    return trimmed.slice(bucketPrefix.length).split(/[?#]/)[0] || null;
  }

  const bucketMarker = `/${BUSINESS_PHOTOS_BUCKET}/`;
  const markerIndex = trimmed.indexOf(bucketMarker);
  if (markerIndex !== -1) {
    const key = trimmed.slice(markerIndex + bucketMarker.length).split(/[?#]/)[0];
    return key ? decodeURIComponent(key) : null;
  }

  if (trimmed.includes("://") || trimmed.startsWith("/")) return null;

  return trimmed.split(/[?#]/)[0] || null;
}