/** Shopfa's own convention for this jewelry store: a product title ending in "*" flags something for inventory follow-up (confirmed present in live titles). */
export function shopfaTitleEndsWithAsterisk(title: string): boolean {
  return title.trim().endsWith("*");
}
