import { copy } from "@/shared/copy.pl";
import { formatPrice } from "@/shared/format";
import type { OfferRecord, Watch } from "@/shared/schemas";
import type { KeyValueStore } from "@/storage/local";

// startSmartBuy.md §6 rule 20: >3 new offers from one check ⇒ one grouped
// notification instead of one per offer. uxSmartBuy.md §5.5: a single
// offer's notification opens that offer; a grouped one opens the popup.
const GROUP_THRESHOLD = 3;

export type NotificationTarget =
  { type: "offer"; offerKey: string; url: string } | { type: "grouped"; watchId: string };

export interface NotificationsPort {
  create(
    id: string,
    options: { title: string; message: string; iconUrl: string },
  ): Promise<void>;
}

const DEFAULT_ICON = "src/assets/icon-128.png";

export class ChromeNotifications implements NotificationsPort {
  create(
    id: string,
    options: { title: string; message: string; iconUrl: string },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.notifications.create(
        id,
        {
          type: "basic",
          title: options.title,
          message: options.message,
          iconUrl: chrome.runtime.getURL(options.iconUrl),
        },
        () => (chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve()),
      );
    });
  }
}

/**
 * Persists what a notification id should do when clicked. A dedicated
 * store (not the main RootStore) because entries are short-lived and keyed
 * by an opaque notification id, not part of the app's durable model.
 */
export class NotificationTargetStore {
  constructor(private readonly kv: KeyValueStore) {}

  async set(notificationId: string, target: NotificationTarget): Promise<void> {
    await this.kv.set(`tb:notif:${notificationId}`, target);
  }

  async take(notificationId: string): Promise<NotificationTarget | undefined> {
    const key = `tb:notif:${notificationId}`;
    const target = await this.kv.get<NotificationTarget>(key);
    await this.kv.remove(key);
    return target;
  }
}

export class Notifier {
  constructor(
    private readonly notifications: NotificationsPort,
    private readonly targets: NotificationTargetStore,
  ) {}

  /** No-ops for an empty list — callers don't need to check first. */
  async notifyNewOffers(watch: Watch, offers: OfferRecord[]): Promise<void> {
    if (offers.length === 0) return;

    if (offers.length > GROUP_THRESHOLD) {
      await this.notifyGrouped(watch, offers);
      return;
    }
    for (const offer of offers) {
      await this.notifySingle(watch, offer);
    }
  }

  private async notifySingle(watch: Watch, offer: OfferRecord): Promise<void> {
    const id = `offer:${offer.key}:${crypto.randomUUID()}`;
    await this.targets.set(id, { type: "offer", offerKey: offer.key, url: offer.url });
    await this.notifications.create(id, {
      title: copy.notification.single(formatPrice(offer.price), offer.title),
      message: copy.notification.singleBody(
        copy.siteNames[offer.site],
        offer.location ?? "",
        watch.name,
      ),
      iconUrl: DEFAULT_ICON,
    });
  }

  private async notifyGrouped(watch: Watch, offers: OfferRecord[]): Promise<void> {
    const id = `grouped:${watch.id}:${crypto.randomUUID()}`;
    await this.targets.set(id, { type: "grouped", watchId: watch.id });
    const prices = offers.map((o) => o.price).filter((p): p is number => p !== null);
    const fromPrice = prices.length ? formatPrice(Math.min(...prices)) : "—";
    const sites = [...new Set(offers.map((o) => copy.siteNames[o.site]))].join(" i ");
    await this.notifications.create(id, {
      title: copy.notification.grouped(offers.length, watch.name),
      message: copy.notification.groupedBody(fromPrice, sites),
      iconUrl: DEFAULT_ICON,
    });
  }
}
