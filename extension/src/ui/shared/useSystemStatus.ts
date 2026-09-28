import { useEffect, useState } from "preact/hooks";

/** Online/offline + OS notification permission — the popup's "Paski
 * systemowe" (uxSmartBuy.md §6) depend on both, neither of which is part
 * of the app's own storage. */
export function useSystemStatus(): { offline: boolean; notificationsDisabled: boolean } {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [notificationsDisabled, setNotificationsDisabled] = useState(false);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function check() {
      chrome.notifications.getPermissionLevel((level) => {
        if (!cancelled) setNotificationsDisabled(level !== "granted");
      });
    }
    check();
    const id = setInterval(check, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { offline, notificationsDisabled };
}
