/**
 * Smart Dish & Category Image Resolver
 * Curated high-resolution, free Unsplash photography matching restaurant menu items
 * inspired by modern food ordering apps (Toast, Sunday, me&u, Square).
 */

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  starters:
    "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
  appetizer:
    "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
  wings:
    "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80",
  bbq:
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
  grill:
    "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
  tikka:
    "https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?auto=format&fit=crop&w=800&q=80",
  kebab:
    "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=800&q=80",
  karahi:
    "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
  curry:
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
  burger:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
  fast_food:
    "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
  beverages:
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
  drinks:
    "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
  lamb:
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  default:
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
};

export function getDishImage(
  itemOrName?:
    | string
    | {
        name?: string;
        image_url?: string | null;
        categoryName?: string;
      }
): string {
  if (typeof itemOrName === "string") {
    const nameLower = itemOrName.toLowerCase();
    for (const [key, url] of Object.entries(FALLBACK_CATEGORY_IMAGES)) {
      if (nameLower.includes(key)) {
        return url;
      }
    }
    return FALLBACK_CATEGORY_IMAGES.default;
  }

  if (itemOrName?.image_url && itemOrName.image_url.startsWith("http")) {
    return itemOrName.image_url;
  }

  const nameLower = (itemOrName?.name || "").toLowerCase();
  const catLower = (itemOrName?.categoryName || "").toLowerCase();

  if (nameLower.includes("wing")) return FALLBACK_CATEGORY_IMAGES.wings;
  if (nameLower.includes("kebab") || nameLower.includes("seekh"))
    return FALLBACK_CATEGORY_IMAGES.kebab;
  if (nameLower.includes("tikka") || nameLower.includes("malai"))
    return FALLBACK_CATEGORY_IMAGES.tikka;
  if (nameLower.includes("karahi") || nameLower.includes("shinwari"))
    return FALLBACK_CATEGORY_IMAGES.karahi;
  if (nameLower.includes("burger") || nameLower.includes("smash"))
    return FALLBACK_CATEGORY_IMAGES.burger;
  if (nameLower.includes("lemonade") || nameLower.includes("cooler") || nameLower.includes("mint"))
    return FALLBACK_CATEGORY_IMAGES.beverages;
  if (nameLower.includes("chop") || nameLower.includes("lamb") || nameLower.includes("steak"))
    return FALLBACK_CATEGORY_IMAGES.lamb;

  if (catLower.includes("bbq") || catLower.includes("grill"))
    return FALLBACK_CATEGORY_IMAGES.bbq;
  if (catLower.includes("starter") || catLower.includes("appetizer"))
    return FALLBACK_CATEGORY_IMAGES.starters;
  if (catLower.includes("karahi") || catLower.includes("curry") || catLower.includes("traditional"))
    return FALLBACK_CATEGORY_IMAGES.karahi;
  if (catLower.includes("fast") || catLower.includes("burger"))
    return FALLBACK_CATEGORY_IMAGES.fast_food;
  if (catLower.includes("beverage") || catLower.includes("drink"))
    return FALLBACK_CATEGORY_IMAGES.drinks;

  return FALLBACK_CATEGORY_IMAGES.default;
}
