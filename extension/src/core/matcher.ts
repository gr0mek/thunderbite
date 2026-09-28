import type { NormalizedOffer } from "@/adapters/types";
import type { Watch } from "@/shared/schemas";

// startSmartBuy.md §7: "Matcher niezależny od serwisów. Filtrowanie słów
// kluczowych, wykluczeń i ceny robi core/matcher.ts na NormalizedOffer, nie
// adaptery. Normalizuj tekst: małe litery, usunięte polskie znaki
// diakrytyczne do porównań, trim."

const DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function normalizeForMatch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch);
}

type MatchableWatch = Pick<
  Watch,
  "keywords" | "excludeKeywords" | "priceMin" | "priceMax"
>;

/**
 * An offer matches when its title contains at least one keyword (OR), none
 * of the excluded words, and its price (if known) falls within the
 * watch's range. Offers with an unknown price ("free" / "negotiable", per
 * adapters/types.ts#NormalizedOffer) are never excluded on price alone —
 * there's nothing to compare, so failing them would just hide real offers.
 */
export function matchesOffer(watch: MatchableWatch, offer: NormalizedOffer): boolean {
  const title = normalizeForMatch(offer.title);

  const hasKeyword = watch.keywords.some((k) => title.includes(normalizeForMatch(k)));
  if (!hasKeyword) return false;

  const hasExcluded = watch.excludeKeywords.some((k) =>
    title.includes(normalizeForMatch(k)),
  );
  if (hasExcluded) return false;

  if (offer.price !== null) {
    if (watch.priceMin !== undefined && offer.price < watch.priceMin) return false;
    if (watch.priceMax !== undefined && offer.price > watch.priceMax) return false;
  }

  return true;
}

export function filterOffers(
  watch: MatchableWatch,
  offers: NormalizedOffer[],
): NormalizedOffer[] {
  return offers.filter((o) => matchesOffer(watch, o));
}
