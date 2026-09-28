// Polish copy for outgoing emails, mirroring uxSmartBuy.md §5.6 and the
// glossary in §7. Deliberately NOT imported from the extension's
// shared/copy.pl.ts — this runs as a separate Deno deployment with its own
// module resolution, so the string of record for email copy lives here.
// Keep in sync by hand if the wording in copy.pl.ts's `email` section changes.

const BRAND = "Thunder Bait";

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function formatPrice(price: number | null): string {
  if (price === null) return "—";
  return `${Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} zł`;
}

export interface EmailOffer {
  title: string;
  price: number | null;
  site: string; // display name, e.g. "Vinted" — already resolved by the caller
  location?: string;
  url: string;
  imageUrl?: string;
}

interface EmailLinks {
  settingsUrl: string;
  unsubscribeUrl: string;
}

function footer(links: EmailLinks): { html: string; text: string } {
  return {
    html: `<p style="font:12px/1.5 sans-serif;color:#646A75;margin-top:24px">
      <a href="${escapeHtml(links.settingsUrl)}">Zmień ustawienia powiadomień</a> ·
      <a href="${escapeHtml(links.unsubscribeUrl)}">Wypisz się</a>
    </p>`,
    text: `Zmień ustawienia powiadomień: ${links.settingsUrl}\nWypisz się: ${links.unsubscribeUrl}`,
  };
}

function offerCardHtml(offer: EmailOffer): string {
  const price = escapeHtml(formatPrice(offer.price));
  const title = escapeHtml(offer.title);
  const meta = escapeHtml([offer.site, offer.location].filter(Boolean).join(" · "));
  const img = offer.imageUrl
    ? `<img src="${escapeHtml(offer.imageUrl)}" alt="${title}" width="64" height="64" style="border-radius:6px;object-fit:cover" />`
    : "";
  return `<table role="presentation" style="width:100%;margin:8px 0">
    <tr>
      <td style="width:72px;vertical-align:top">${img}</td>
      <td style="vertical-align:top;font-family:sans-serif">
        <div style="font-weight:700">${price}</div>
        <div>${title}</div>
        <div style="color:#646A75;font-size:13px">${meta}</div>
        <a href="${escapeHtml(offer.url)}" style="display:inline-block;margin-top:6px">Zobacz ofertę</a>
      </td>
    </tr>
  </table>`;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** §5.6 "Natychmiast": one offer, sent as soon as it's found. */
export function renderImmediateEmail(offer: EmailOffer, links: EmailLinks): RenderedEmail {
  const subject = `${formatPrice(offer.price)} · ${offer.title}`;
  const f = footer(links);
  return {
    subject,
    html: `<div style="font-family:sans-serif">${offerCardHtml(offer)}${f.html}</div>`,
    text: `${subject}\n${offer.url}\n\n${f.text}`,
  };
}

/** §5.6 "Raz dziennie": offers grouped by watch, max 5 shown per group
 * ("i N więcej" for the rest). */
export function renderDailyDigestEmail(
  offersByWatch: Map<string, EmailOffer[]>,
  links: EmailLinks,
): RenderedEmail {
  const total = [...offersByWatch.values()].reduce((n, list) => n + list.length, 0);
  const subject = `${BRAND}: ${total} nowych ofert`;

  const groups = [...offersByWatch.entries()].map(([watchName, offers]) => {
    const shown = offers.slice(0, 5);
    const rest = offers.length - shown.length;
    const html = `<h3 style="font:700 14px sans-serif">${escapeHtml(watchName)}</h3>
      ${shown.map(offerCardHtml).join("")}
      ${rest > 0 ? `<div style="color:#646A75;font-size:13px">i ${rest} więcej</div>` : ""}`;
    const text = [
      watchName,
      ...shown.map((o) => `  ${formatPrice(o.price)} · ${o.title} — ${o.url}`),
      rest > 0 ? `  i ${rest} więcej` : null,
    ]
      .filter(Boolean)
      .join("\n");
    return { html, text };
  });

  const f = footer(links);
  return {
    subject,
    html: `<div style="font-family:sans-serif">${groups.map((g) => g.html).join("")}${f.html}</div>`,
    text: `${subject}\n\n${groups.map((g) => g.text).join("\n\n")}\n\n${f.text}`,
  };
}

/** §5.6 "Problem": informational only, no action expected from the user. */
export function renderProblemEmail(
  args: { site: string; since: string; affectedWatchNames: string[] },
  links: EmailLinks,
): RenderedEmail {
  const subject = `${BRAND} nie może sprawdzić ${args.site}`;
  const watches = args.affectedWatchNames.join(", ");
  const body = `${escapeHtml(args.site)} ma problem z pobieraniem od ${escapeHtml(
    args.since,
  )}. Dotyczy obserwacji: ${escapeHtml(watches)}. Pozostałe serwisy działają normalnie — nie musisz nic robić, spróbujemy ponownie automatycznie.`;
  const f = footer(links);
  return {
    subject,
    html: `<div style="font-family:sans-serif"><p>${body}</p>${f.html}</div>`,
    text: `${subject}\n\n${body}\n\n${f.text}`,
  };
}
