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

/** Roman numerals in model names ("mju II", "Mark III") match their
 * arabic spelling ("mju 2"). "i" is left alone — it's Polish for "and". */
const ROMAN: Record<string, string> = { ii: "2", iii: "3", iv: "4" };

/**
 * Lowercase, strip Polish diacritics, treat punctuation as spaces, collapse
 * whitespace, and spell model numbers one way, so "Olympus Mju-II",
 * "mju:ii", "μ-II" and "mju 2" all normalize to "... mju 2".
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => DIACRITICS[ch] ?? ch)
    .replace(/[μµ]/g, " mju ")
    .replace(/[-_:;/\\.,()[\]"'+|]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ROMAN[token] ?? token)
    .join(" ");
}

function containsPhrase(normalizedTitle: string, phrase: string): boolean {
  const needle = normalizeForMatch(phrase);
  return needle.length > 0 && ` ${normalizedTitle} `.includes(needle);
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
  if (!matchesKeywords(watch, offer)) return false;

  if (offer.price !== null) {
    if (watch.priceMin !== undefined && offer.price < watch.priceMin) return false;
    if (watch.priceMax !== undefined && offer.price > watch.priceMax) return false;
  }

  return true;
}

/** Keywords and exclusions only, ignoring price — what deal mode uses to
 * decide which listings describe the item (and so feed its market price). */
export function matchesKeywords(
  watch: Pick<Watch, "keywords" | "excludeKeywords">,
  offer: Pick<NormalizedOffer, "title">,
): boolean {
  const title = normalizeForMatch(offer.title);
  if (!watch.keywords.some((k) => containsPhrase(title, k))) return false;
  return !watch.excludeKeywords.some((k) => containsPhrase(title, k));
}

export function filterOffers(
  watch: MatchableWatch,
  offers: NormalizedOffer[],
): NormalizedOffer[] {
  return offers.filter((o) => matchesOffer(watch, o));
}
