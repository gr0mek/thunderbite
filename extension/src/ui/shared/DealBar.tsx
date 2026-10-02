import { formatPrice } from "@/shared/format";
import { dealThreshold } from "@/core/market";

interface DealBarProps {
  median: number;
  thresholdPct: number;
}

/** One-line scale from 0 to 1.5× the market median: the yellow zone is
 * where a deal would land, the tick is the median. */
export function DealBar({ median, thresholdPct }: DealBarProps) {
  const max = median * 1.5;
  const threshold = dealThreshold(median, thresholdPct);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div class="deal-bar" aria-hidden="true">
      <div class="deal-bar-track" />
      <div class="deal-bar-zone" style={{ width: pct(threshold) }} />
      <div class="deal-bar-median" style={{ left: pct(median) }} />
      <span class="deal-bar-label" style={{ left: pct(threshold) }}>
        {formatPrice(threshold)}
      </span>
      <span class="deal-bar-label" style={{ left: pct(median) }}>
        {formatPrice(median)}
      </span>
    </div>
  );
}
