// A fetch() from the service worker reaches Vinted with
// `Origin: chrome-extension://<id>` and no Referer — an obvious non-browsing
// request that Vinted's anti-bot layer tends to answer with 403. The
// reference client (Vinted-Notifications) never sends an Origin at all, so
// we strip it and set the Referer a normal page visit would have.
//
// The rule only matches requests made outside any tab (tabIds: [-1] — i.e.
// this extension's service worker), so the user's own browsing of Vinted
// is never touched.

export const VINTED_HEADER_RULE_ID = 1;

export function vintedHeaderRule(): chrome.declarativeNetRequest.Rule {
  return {
    id: VINTED_HEADER_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType,
      requestHeaders: [
        {
          header: "origin",
          operation: "remove" as chrome.declarativeNetRequest.HeaderOperation,
        },
        {
          header: "referer",
          operation: "set" as chrome.declarativeNetRequest.HeaderOperation,
          value: "https://www.vinted.pl/",
        },
      ],
    },
    condition: {
      requestDomains: ["vinted.pl"],
      tabIds: [-1],
      resourceTypes: [
        "xmlhttprequest" as chrome.declarativeNetRequest.ResourceType,
        "other" as chrome.declarativeNetRequest.ResourceType,
      ],
    },
  };
}

/** Installs (or replaces) the rule. Session rules don't survive a browser
 * restart, so this runs on every service-worker start. */
export async function installVintedHeaderRule(): Promise<boolean> {
  if (!chrome.declarativeNetRequest?.updateSessionRules) return false;
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [VINTED_HEADER_RULE_ID],
    addRules: [vintedHeaderRule()],
  });
  return true;
}

export async function isVintedHeaderRuleActive(): Promise<boolean> {
  if (!chrome.declarativeNetRequest?.getSessionRules) return false;
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.some((r) => r.id === VINTED_HEADER_RULE_ID);
}
