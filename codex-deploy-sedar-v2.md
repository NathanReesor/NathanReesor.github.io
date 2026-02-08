# Deploy SedarSentiment v2

## What changed
This is a drop-in replacement for `blog-app/src/SedarSentiment.jsx`. No changes needed to `App.jsx` — the component signature (`rawJson`, `priceData`, `ticker`, `tickerDisplay`) is identical.

## Action
Replace the contents of `blog-app/src/SedarSentiment.jsx` with the attached file.

## Key fixes in v2

1. **No lag** — Tone bars plot at period-end date, not +45 days. Price line finds nearest weekly close to period date directly.

2. **Correct units** — Y-axis reads "Δ hits/10K" (the raw delta rate). No ×1000 scaling. The values are what they are.

3. **Risk-aware POS coloring** — POS has `risk: "down"` so +delta (more positive language) = GREEN, not red. All other categories (neg, unc, lit, constr) keep +delta = RED. Composite keeps +delta = RED (since composite weights pos negatively).

4. **fullPeriod as data key** — XAxis uses `dataKey="fullPeriod"` (YYYY-MM-DD) with `tickFormatter={fmtTick}` for display. No more merging data points by formatted month labels. This fixes collision issues especially for news releases.

5. **Combined doc groups** — Default is "MD&A" which includes both `interim_mda` and `annual_mda`. Annual filings fill the Q4 gap (Dec-31 periods that interims don't cover). No period overlap exists. Same for "Fin. Stmts" combining both FS types.

6. **Group z-scores** — `zgrp_*` computed across the combined group (e.g. all 18 MD&A filings). Doc-type z-scores (`zdt_*`) also computed but group z is the default since we're showing combined groups.

7. **Reliability flag** — Filings where `min(curr_words, prev_words) < 500` are flagged as unreliable. Bars render faded, tooltips show warning, stats exclude them from outlier calculations.

8. **Rich tooltips** — Custom `ResearchTooltip` component shows: period, doc type, delta rate, z-score, price, word count (curr + prev), expansion %, sentences +/−, and reliability warning.

9. **3 views instead of 5** — Consolidated into:
   - **Price × Tone** (delta/level toggle within same view)
   - **Filing Analysis** (z-score chart + event table + section alerts + rankings)
   - **Section Drilldown** (heatmap + click-to-expand with drivers/sentences)

10. **Annual filing markers** — Annual filings get bordered bars in charts and ★ labels in tables so users can visually distinguish them in the combined view.

11. **Drivers in drilldown** — When clicking a heatmap cell, shows matched words from `drivers` data (top added/removed sentences with matched dictionary terms). Falls back to `drilldown` sentences if no drivers data.

## Commit message
"SedarSentiment v2: fix lag/units/POS-color, combine doc groups, add reliability, rich tooltips"
