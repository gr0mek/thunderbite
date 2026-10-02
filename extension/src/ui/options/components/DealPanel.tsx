import { useState } from "preact/hooks";
import { copy } from "@/shared/copy.pl";
import { formatPrice } from "@/shared/format";
import { watchCurrency } from "@/shared/sites";
import { dealThreshold } from "@/core/market";
import {
  DEAL_SUSPICIOUS_BELOW_PCT,
  MARKET_MIN_SAMPLE,
  MARKET_WINDOW_DAYS,
  type OfferRecord,
  type PricePoint,
  type Watch,
} from "@/shared/schemas";
import { usePriceHistory } from "@/ui/shared/dataHooks";

const timeFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

interface Tip {
  x: number;
  y: number;
  text: string;
}

/** Dot plot of every recent listing's price on one axis, with the deal
 * zone, the suspicious zone and the median — shows where the threshold
 * comes from. Each dot has a hover tooltip; a summary is in aria-label. */
function PriceStrip({
  points,
  median,
  threshold,
  dealIds,
  currency,
}: {
  points: PricePoint[];
  median: number;
  threshold: number;
  dealIds: Set<string>;
  currency: string;
}) {
  const price = (n: number) => formatPrice(n, currency);
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 800;
  const X0 = 16;
  const X1 = 784;
  const BASE = 86;
  const top = Math.max(median * 1.6, ...points.map((p) => p.price)) || 1;
  // Cheap eBay items ($20–$150) need finer ticks than zł prices do.
  const step =
    top > 4000
      ? 1000
      : top > 1500
        ? 500
        : top > 400
          ? 100
          : top > 150
            ? 50
            : top > 40
              ? 10
              : 5;
  const max = Math.ceil(top / step) * step;
  const x = (v: number) => X0 + (Math.min(v, max) / max) * (X1 - X0);
  const suspicious = (median * DEAL_SUSPICIOUS_BELOW_PCT) / 100;
  const ticks = Array.from(
    { length: Math.floor(max / step) + 1 },
    (_, i) => i * step,
  ).filter((_, i, all) => all.length <= 9 || i % 2 === 0);

  // Stack dots that share a price bucket so they don't hide each other.
  const bucket = (max / (X1 - X0)) * 10;
  const stacks = new Map<number, number>();
  const dots = [...points]
    .sort((a, b) => a.price - b.price)
    .map((p) => {
      const k = Math.round(p.price / bucket);
      const level = stacks.get(k) ?? 0;
      stacks.set(k, level + 1);
      return {
        p,
        cx: x(p.price),
        cy: BASE - 8 - (level % 7) * 9,
        deal: dealIds.has(p.externalId),
      };
    });

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} 120`}
        width="100%"
        role="img"
        aria-label={copy.deal.chartLabel(points.length, price(median), price(threshold))}
      >
        <rect
          x={x(0)}
          y={16}
          width={x(threshold) - x(0)}
          height={BASE - 16}
          rx={4}
          fill="var(--tag)"
          opacity={0.35}
        />
        <rect
          x={x(0)}
          y={16}
          width={x(suspicious) - x(0)}
          height={BASE - 16}
          rx={4}
          fill="var(--warn)"
          opacity={0.15}
        />
        <line x1={X0} x2={X1} y1={BASE} y2={BASE} stroke="var(--line)" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={BASE} y2={BASE + 4} stroke="var(--line)" />
            <text
              x={x(t)}
              y={BASE + 18}
              font-size={11}
              fill="var(--ink-muted)"
              text-anchor={t === 0 ? "start" : t === max ? "end" : "middle"}
            >
              {price(t)}
            </text>
          </g>
        ))}
        <line
          x1={x(threshold)}
          x2={x(threshold)}
          y1={10}
          y2={BASE}
          stroke="var(--ink)"
          stroke-dasharray="3 3"
        />
        <text x={x(threshold) + 6} y={12} font-size={11} fill="var(--ink)">
          {copy.deal.chartThreshold(price(threshold))}
        </text>
        <line
          x1={x(median)}
          x2={x(median)}
          y1={10}
          y2={BASE}
          stroke="var(--ink)"
          stroke-width={2}
        />
        <text x={x(median) + 6} y={12} font-size={11} fill="var(--ink)">
          {copy.deal.chartMedian(price(median))}
        </text>
        {dots.map(({ p, cx, cy, deal }) => (
          <circle
            key={p.key}
            cx={cx}
            cy={cy}
            r={deal ? 6 : 4}
            fill={deal ? "var(--action)" : "var(--ink-muted)"}
            stroke="var(--bg)"
            stroke-width={2}
            style={{ cursor: "pointer" }}
            onMouseEnter={(e) =>
              setTip({
                x: (e as MouseEvent).offsetX,
                y: (e as MouseEvent).offsetY,
                text: `${price(p.price)} · ${p.title}`,
              })
            }
            onMouseLeave={() => setTip(null)}
            onClick={() => void chrome.tabs.create({ url: p.url })}
          />
        ))}
      </svg>
      {tip && (
        <div class="chart-tip" style={{ left: tip.x + 12, top: tip.y - 28 }}>
          {tip.text}
        </div>
      )}
    </div>
  );
}

interface DealPanelProps {
  watch: Watch;
  offers: OfferRecord[];
  onOpenOffer: (offer: OfferRecord) => void;
}

/** Deal mode section of the watch detail page (options): market tiles,
 * the price dot plot and the deals caught so far. */
export function DealPanel({ watch, offers, onOpenOffer }: DealPanelProps) {
  const d = copy.deal;
  const points = usePriceHistory(watch.id, MARKET_WINDOW_DAYS);
  const market = watch.market;
  const pct = watch.deal?.thresholdPct ?? 50;
  const deals = offers
    .filter((o) => o.dealKind === "deal")
    .sort((a, b) => b.foundAt.localeCompare(a.foundAt));

  if (!market) {
    return (
      <div class="options-panel">
        <span class="text-offer-title">{d.chartTitle}</span>
        <span class="text-meta">
          {d.chartEmpty} ({d.marketLearningShort(points.length, MARKET_MIN_SAMPLE)})
        </span>
      </div>
    );
  }

  const threshold = dealThreshold(market.median, pct);
  const currency = watchCurrency(watch);
  const price = (n: number | null) => formatPrice(n, currency);
  const dealIds = new Set(deals.map((o) => o.externalId));

  return (
    <div class="col gap3">
      <div class="deal-tiles">
        <div class="deal-tile">
          <div class="text-meta">{d.tileMarket}</div>
          <div class="deal-tile-value">{price(market.median)}</div>
          <div class="text-meta">{d.tileMarketSub}</div>
        </div>
        <div class="deal-tile">
          <div class="text-meta">{d.tileRange}</div>
          <div class="deal-tile-value">
            {price(market.p25)}–{price(market.p75)}
          </div>
          <div class="text-meta">{d.tileRangeSub}</div>
        </div>
        <div class="deal-tile deal-tile--hl">
          <div class="text-meta">{d.tileThreshold(pct)}</div>
          <div class="deal-tile-value">{price(threshold)}</div>
          <div class="text-meta">{d.tileThresholdSub}</div>
        </div>
        <div class="deal-tile">
          <div class="text-meta">{d.tileSample}</div>
          <div class="deal-tile-value">{d.tileSampleValue(market.sampleSize)}</div>
          <div class="text-meta">{d.tileSampleSub}</div>
        </div>
      </div>

      <div class="options-panel">
        <div class="fx ac jb wrap gap2" style={{ flexDirection: "row" }}>
          <span class="text-offer-title">{d.chartTitle}</span>
          <span class="fx ac gap3 text-meta">
            <span class="fx ac gap1">
              <span class="legend-dot" style={{ background: "var(--ink-muted)" }} />
              {d.chartLegendOffer}
            </span>
            <span class="fx ac gap1">
              <span class="legend-dot" style={{ background: "var(--action)" }} />
              {d.chartLegendDeal}
            </span>
            <span class="fx ac gap1">
              <span
                class="legend-dot"
                style={{ background: "var(--tag)", borderRadius: 2 }}
              />
              {d.chartLegendZone}
            </span>
          </span>
        </div>
        <PriceStrip
          points={points}
          median={market.median}
          threshold={threshold}
          dealIds={dealIds}
          currency={currency}
        />
      </div>

      <div class="options-panel">
        <span class="text-offer-title">{d.dealsTitle}</span>
        {deals.length === 0 ? (
          <span class="text-meta">{d.dealsEmpty}</span>
        ) : (
          <table class="options-table">
            <thead>
              <tr>
                <th>{d.colWhen}</th>
                <th>{d.colOffer}</th>
                <th style={{ textAlign: "right" }}>{d.colPrice}</th>
                <th style={{ textAlign: "right" }}>{d.colDiscount}</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((o) => (
                <tr key={o.key}>
                  <td class="text-meta">{timeFormat.format(new Date(o.foundAt))}</td>
                  <td>
                    <button
                      type="button"
                      class="link-button"
                      onClick={() => onOpenOffer(o)}
                    >
                      {o.title}
                    </button>
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {price(o.price)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {o.discountPct !== undefined && d.discount(o.discountPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
