// All user-facing strings, in one place per uxSmartBuy.md §10 DoD ("Wszystkie
// teksty pochodzą z jednego pliku copy.pl.ts"). Vocabulary follows the
// glossary in §7 exactly — do not paraphrase these terms elsewhere.
//
// Product name is "Thunder Bait" (renamed from "Smart Buy" mid-design, see
// chats/chat1.md) — every string below uses the new name.

export const copy = {
  brand: {
    name: "Thunder Bait",
  },

  tabs: {
    new: "Nowe",
    watching: "Obserwuję",
  },

  offerRow: {
    hide: "Ukryj",
    seenLabel: "Widziana",
  },

  popupFooter: {
    markAllSeen: "Oznacz wszystkie jako widziane",
    addWatch: "+ Obserwuj",
    seeAllOffers: "Zobacz wszystkie oferty",
  },

  quickAddBanner: {
    title: "Obserwuj to wyszukiwanie",
    cta: "Zacznij obserwować",
    contextLine: (site: string, query: string, extra: string) =>
      `Jesteś na ${site}: „${query}”${extra}`,
  },

  watchTile: {
    newBadge: (n: number) => `${n} nowe`,
    checkedAgo: (rel: string) => `sprawdzono ${rel}`,
    paused: "Wstrzymana",
    problem: (site: string) => `${site}: problem z pobieraniem`,
  },

  watchMenu: {
    edit: "Edytuj",
    checkNow: "Sprawdź teraz",
    pause: "Wstrzymaj",
    resume: "Wznów",
    delete: "Usuń",
  },

  form: {
    titleNew: "Nowa obserwacja",
    titleEdit: "Edytuj",
    nameLabel: "Czego szukasz?",
    nameVariantsLabel: "Warianty nazwy (opcjonalnie)",
    addVariant: "+ dodaj",
    priceMaxLabel: "Cena maks.",
    priceMinLabel: "Cena min.",
    currency: "zł",
    sitesLabel: "Gdzie szukać",
    siteShort: { olx: "OLX", vinted: "Vin", allegro: "All" },
    intervalLabel: "Sprawdzaj co",
    intervalPreset: (minutes: number) =>
      minutes < 60 ? `${minutes} min` : `${minutes / 60} h`,
    notifyLabel: "Powiadamiaj",
    notifyBrowser: "w przeglądarce",
    emailLabel: "E-mail:",
    emailModeImmediate: "Natychmiast",
    emailModeDaily: "Raz dziennie",
    emailModeOff: "Wyłączony",
    emailUnverified: "Adres niezweryfikowany.",
    addEmail: "Dodaj e-mail",
    moreFilters: "Więcej filtrów",
    moreFiltersSummary: "cena min. · wyklucz słowa · lokalizacja · stan · rozmiar",
    excludeKeywordsLabel: "Wyklucz słowa",
    locationLabel: "Lokalizacja",
    conditionLabel: "Stan",
    conditionNew: "Nowy",
    conditionUsed: "Używany",
    conditionAny: "Dowolny",
    sizeLabel: "Rozmiar",
    submitNew: "Zacznij obserwować",
    submitEdit: "Zapisz zmiany",
    validation: {
      nameRequired: "Podaj nazwę (min. 2 znaki).",
      priceOrder: "Cena min. musi być niższa niż maks.",
    },
  },

  onboarding: {
    pitch:
      "Thunder Bait sprawdza OLX, Vinted i Allegro za Ciebie i daje znać, gdy pojawi się pasująca oferta.",
    emailLabel: "E-mail (opcjonalnie)",
    emailPlaceholder: "ty@example.com",
    save: "Zapisz",
    addFirstWatch: "Dodaj pierwszą obserwację",
    skip: "Pomiń",
    permissionNote:
      "O zgodę na powiadomienia zapytamy po zapisaniu pierwszej obserwacji.",
  },

  optionsNav: {
    watches: "Obserwacje",
    offers: "Oferty",
    settings: "Ustawienia",
  },

  watchDetail: {
    breadcrumb: "Obserwacje /",
    filterSentence: (
      keywords: string,
      priceMax: string | null,
      sites: string,
      interval: string,
    ) => `${keywords}${priceMax ? ` do ${priceMax}` : ""}, ${sites}, co ${interval}`,
    checkedAgo: (rel: string) => `sprawdzono ${rel}`,
    checkNow: "Sprawdź teraz",
    pause: "Wstrzymaj",
    resume: "Wznów",
    edit: "Edytuj",
    filterTabs: {
      new: (n: number) => `Nowe ${n}`,
      seen: "Widziane",
      hidden: "Ukryte",
    },
    alreadyAvailable: (n: number) => `Już dostępne (${n})`,
  },

  settings: {
    title: "Ustawienia",
    emailSection: "E-mail",
    verified: "Zweryfikowany",
    unverified: "Niezweryfikowany",
    sendTestEmail: "Wyślij testowy e-mail",
    defaultsSection: "Domyślne wartości nowej obserwacji",
    digestHourLabel: "Godzina zestawienia",
    servicesSection: "Serwisy",
    serviceWorking: "działa",
    serviceProblem: "problem z pobieraniem",
    lastSuccessfulCheck: (rel: string) => `ostatnie udane sprawdzenie ${rel}`,
    problemSince: (time: string) => `problem z pobieraniem od ${time}`,
    errorCount: (n: number) =>
      `${n} ${n === 1 ? "błąd" : n < 5 ? "błędy" : "błędów"}${n > 0 ? " z rzędu" : ""}`,
    dataSection: "Dane",
    dataDescription: "Usuwa obserwacje, oferty i ustawienia z tej przeglądarki.",
    deleteAllData: "Usuń wszystkie dane",
    deleteAllDataConfirmTitle: "Usunąć wszystkie dane?",
    deleteAllDataConfirmBody:
      "Obserwacje, oferty i ustawienia zostaną trwale usunięte z tej przeglądarki. Tej operacji nie można cofnąć.",
    deleteAllDataConfirmCta: "Usuń wszystko",
    cancel: "Anuluj",
  },

  siteNames: { olx: "OLX", vinted: "Vinted", allegro: "Allegro" },
  siteInitial: { olx: "O", vinted: "V", allegro: "A" },

  emptyStates: {
    noWatches: "Nie obserwujesz jeszcze niczego.",
    addFirstWatch: "Dodaj pierwszą obserwację",
    noNewOffers: (rel: string) => `Nic nowego. Ostatnie sprawdzenie: ${rel}.`,
    seeEarlierOffers: "Zobacz wcześniejsze oferty",
    firstCheckInProgress: "Pierwsze sprawdzenie w toku",
    checkingSites: "Sprawdzam OLX, Vinted i Allegro…",
  },

  banners: {
    offline: "Brak internetu. Sprawdzanie wznowi się automatycznie.",
    notificationsDisabled: "Powiadomienia są wyłączone w przeglądarce.",
    enable: "Włącz",
    serviceProblem: (site: string) =>
      `${site}: problem z pobieraniem. Inne serwisy działają.`,
    watchLimitReached: (limit: number) =>
      `Masz już ${limit} obserwacji. Usuń lub wstrzymaj jedną, żeby dodać nową.`,
    lowResultsHint: "Brak ofert od tygodnia. Spróbuj szerszej nazwy lub wyższej ceny.",
  },

  toast: {
    watchingStarted: (name: string) => `Obserwujesz: ${name}. Pierwsze sprawdzenie trwa…`,
    watchPaused: (name: string) => `Wstrzymano: ${name}`,
    watchDeleted: (name: string) => `Usunięto: ${name}`,
    undo: "Cofnij",
  },

  notification: {
    single: (price: string, title: string) => `${price} · ${title}`,
    singleBody: (site: string, location: string, watchName: string) =>
      `${site} · ${location} — z obserwacji „${watchName}”`,
    grouped: (n: number, watchName: string) => `${n} nowych ofert · ${watchName}`,
    groupedBody: (fromPrice: string, sites: string) => `od ${fromPrice}, ${sites}`,
    open: "Otwórz",
    hide: "Ukryj",
  },

  email: {
    immediateSubject: (price: string, title: string) => `${price} · ${title}`,
    dailySubject: (n: number) => `Thunder Bait: ${n} nowych ofert`,
    dailyMore: (n: number) => `i ${n} więcej`,
    problemSubject: (site: string) => `Thunder Bait nie może sprawdzić ${site}`,
    viewOffer: "Zobacz ofertę",
    footerSettings: "Zmień ustawienia powiadomień",
    footerUnsubscribe: "Wypisz się",
  },

  relativeTime: {
    justNow: "przed chwilą",
    minutesAgo: (n: number) => `${n} min temu`,
    hoursAgo: (n: number) => `${n} h temu`,
  },

  price: {
    format: (n: number) => `${n.toLocaleString("pl-PL").replace(/ /g, " ")} zł`,
  },
} as const;
