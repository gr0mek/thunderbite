/** A single loading row — uxSmartBuy.md §6 "Pierwsze sprawdzenie w toku". */
export function Skeleton() {
  return (
    <div class="fx ac gap3" style={{ padding: "0 16px" }}>
      <span class="skeleton-block" style={{ width: 56, height: 56, borderRadius: 6 }} />
      <span class="col gap2 f1">
        <span class="skeleton-block" style={{ height: 12, width: "70%" }} />
        <span class="skeleton-block" style={{ height: 10, width: "45%" }} />
      </span>
    </div>
  );
}
