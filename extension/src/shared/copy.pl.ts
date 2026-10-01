// All user-facing strings, in one place per uxSmartBuy.md §10 DoD ("Wszystkie
// teksty pochodzą z jednego pliku copy.pl.ts"). Vocabulary follows the
// glossary in §7 exactly — do not paraphrase these terms elsewhere.
//
// Product name is "Thunder Bait" (renamed from "Smart Buy" mid-design, see
// chats/chat1.md) — every string below uses the new name.

/** "1 oferta", "3 oferty", "5 ofert", "22 oferty", "12 ofert". */
function offersCount(n: number): string {
  if (n === 1) return "1 oferta";
  const lastTwo = n % 100;
  const last = n % 10;
  const few = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14);
  return `${n} ${few ? "oferty" : "ofert"}`;
}

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

  offerState: {
    new: "Nowa",
    seen: "Widziana",
    hidden: "Ukryta",
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
    problem: (site: string, code?: string) =>
      `${site}: problem z pobieraniem${code ? ` (${code})` : ""}`,
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
    namePlaceholder: "np. Leica M6",
    nameVariantsLabel: "Warianty nazwy (opcjonalnie)",
    addVariant: "+ dodaj",
    priceMaxLabel: "Cena maks.",
    priceMinLabel: "Cena min.",
    currency: "zł",
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
    cityPlaceholder: "Miasto",
    radiusLabel: "Promień (km)",
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
      "Thunder Bait sprawdza Vinted za Ciebie i daje znać, gdy pojawi się pasująca oferta.",
    emailLabel: "E-mail (opcjonalnie)",
    emailPlaceholder: "ty@example.com",
    save: "Zapisz",
    addFirstWatch: "Dodaj pierwszą obserwację",
    skip: "Pomiń",
    permissionNote:
      "O zgodę na powiadomienia zapytamy po zapisaniu pierwszej obserwacji.",
  },

  common: {
    back: "Wstecz",
    allFeminine: "wszystkie",
  },

  offersScreen: {
    empty: "Brak ofert w tym widoku.",
  },

  optionsNav: {
    watches: "Obserwacje",
    offers: "Oferty",
    settings: "Ustawienia",
    diagnostics: "Diagnostyka",
  },

  watchesTable: {
    name: "Nazwa",
    sites: "Serwisy",
    priceMax: "Cena maks.",
    interval: "Co ile",
    newOffers: "Nowe",
    lastChecked: "Ostatnie sprawdzenie",
    status: "Status",
  },

  watchStatus: {
    active: "Aktywna",
    paused: "Wstrzymana",
    problem: "Problem",
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
    lastErrorCode: (code: string) => `kod błędu ${code}`,
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

  // Stable diagnostic codes (shared/schemas.ts SCAN_ERROR_CODES): what
  // happened, and what the user can try.
  scanErrors: {
    "VNT-401": {
      title: "Brak sesji Vinted (HTTP 401)",
      hint: "Otwórz vinted.pl w tej przeglądarce, odśwież stronę i kliknij „Test połączenia”.",
    },
    "VNT-403": {
      title: "Vinted zablokował zapytanie (HTTP 403, ochrona antybotowa)",
      hint: "Zostaw otwartą kartę vinted.pl — rozszerzenie pobierze wyniki przez nią. Jeśli Vinted pokazuje captchę, rozwiąż ją.",
    },
    "VNT-404": {
      title:
        "Vinted odrzucił zapytanie (HTTP 404 — tak odpowiada też przy nieważnej sesji)",
      hint: "Zostaw otwartą kartę vinted.pl — rozszerzenie pobierze wyniki przez nią. Jeśli błąd zostaje mimo otwartej karty, skopiuj raport.",
    },
    "VNT-429": {
      title: "Za dużo zapytań (HTTP 429)",
      hint: "Vinted ogranicza tempo. Wydłuż odstęp sprawdzania lub wstrzymaj część obserwacji.",
    },
    "VNT-5XX": {
      title: "Błąd serwera Vinted (HTTP 5xx)",
      hint: "Zwykle przejściowe — kolejne sprawdzenie spróbuje ponownie.",
    },
    "VNT-HTTP": {
      title: "Nieoczekiwany status HTTP",
      hint: "Skopiuj raport i zgłoś problem.",
    },
    "VNT-NET": {
      title: "Błąd sieci",
      hint: "Sprawdź połączenie, VPN i blokery reklam (mogą blokować vinted.pl).",
    },
    "VNT-TIMEOUT": {
      title: "Vinted nie odpowiedział w 20 s",
      hint: "Zwykle przejściowe. Jeśli się powtarza, sprawdź połączenie.",
    },
    "VNT-JSON": {
      title: "Odpowiedź nie jest danymi (np. strona captcha)",
      hint: "Otwórz vinted.pl, rozwiąż ewentualną captchę i zostaw kartę otwartą.",
    },
    "VNT-SHAPE": {
      title: "Nieznany format odpowiedzi Vinted",
      hint: "Vinted zmienił API. Skopiuj raport i zgłoś problem.",
    },
    "VNT-EMPTY": {
      title: "Vinted zwrócił pustą listę ofert",
      hint: "Jeśli się powtarza, skopiuj raport i zgłoś problem.",
    },
    "APP-UNKNOWN": {
      title: "Nieznany błąd aplikacji",
      hint: "Skopiuj raport i zgłoś problem.",
    },
  },

  diagnostics: {
    title: "Diagnostyka",
    intro:
      "Szczegóły ostatnich skanów Vinted. Gdy coś nie działa, kod błędu i raport pomagają ustalić przyczynę.",
    statusSection: "Stan połączenia",
    statusOk: "działa",
    statusProblem: "problem z pobieraniem",
    lastSuccess: (rel: string) => `ostatni udany skan ${rel}`,
    neverSucceeded: "jeszcze bez udanego skanu",
    lastError: (rel: string, code?: string) =>
      `ostatni błąd ${rel}${code ? ` (${code})` : ""}`,
    testConnection: "Test połączenia",
    testing: "Testuję…",
    testOk: (n: number) => `Połączenie działa — pobrano ${offersCount(n)}.`,
    testFailed: (code: string) => `Test nieudany: ${code}`,
    environmentSection: "Środowisko",
    envVersion: "Wersja rozszerzenia",
    envSessionCookie: "Sesja Vinted (ciasteczko access_token_web)",
    envCookies: "Ciasteczka vinted.pl (nazwy)",
    envTabs: "Otwarte karty vinted.pl",
    envHeaderRule: "Reguła nagłówków (bez Origin)",
    yes: "tak",
    no: "nie",
    none: "brak",
    active: "aktywna",
    inactive: "nieaktywna",
    scansSection: "Log skanowania",
    scansEmpty:
      "Brak zapisanych skanów. Uruchom test połączenia lub poczekaj na sprawdzenie obserwacji.",
    colTime: "Kiedy",
    colWhat: "Co",
    colResult: "Wynik",
    colCounts: "Pobrano / pasuje / nowe",
    colDuration: "Czas",
    healthScan: "Test połączenia",
    baseline: "pierwsze sprawdzenie",
    ok: "OK",
    requests: "Zapytania",
    reqVia: { sw: "w tle", tab: "przez kartę" },
    reqStatus: (status: number | null) =>
      status === null ? "brak odpowiedzi" : `HTTP ${status}`,
    reqItems: (n: number) => offersCount(n),
    reqAttempt: (n: number) => `próba ${n}`,
    errorMessage: "Komunikat",
    responseStart: "Początek odpowiedzi",
    copyReport: "Kopiuj raport",
    copied: "Skopiowano raport do schowka",
    clearLog: "Wyczyść log",
    techLogSection: "Log techniczny",
    techLogEmpty: "Brak wpisów.",
    filterAll: "Wszystkie",
    filterErrors: "Tylko błędy",
    details: "Szczegóły",
  },

  siteNames: { vinted: "Vinted" },
  siteInitial: { vinted: "V" },

  emptyStates: {
    noWatches: "Nie obserwujesz jeszcze niczego.",
    addFirstWatch: "Dodaj pierwszą obserwację",
    noNewOffers: (rel: string) => `Nic nowego. Ostatnie sprawdzenie: ${rel}.`,
    seeEarlierOffers: "Zobacz wcześniejsze oferty",
    firstCheckInProgress: "Pierwsze sprawdzenie w toku",
    checkingSites: "Sprawdzam Vinted…",
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
    // §7: "4 200 zł" — a plain space as the thousands separator. Built by
    // hand rather than via toLocaleString("pl-PL"), whose grouping
    // character depends on the runtime's ICU data (not deterministic
    // across environments/browsers).
    format: (n: number) =>
      `${Math.round(n)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, " ")} zł`,
  },
} as const;
