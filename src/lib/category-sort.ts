/** A–Z by name, ignoring case ("FASHION ACCESIORES" sorts next to "Fashion", "Auto Parts" before both). */
export const compareCategoryName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

export function sortCategoriesAZ<T extends { name: string }>(list: readonly T[]): T[] {
  return [...list].sort(compareCategoryName);
}
