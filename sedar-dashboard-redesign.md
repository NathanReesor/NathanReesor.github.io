# SEDAR Sentiment Dashboard — Redesign Spec

## Data Available (per ticker JSON)

| Field | Source | What it gives you |
|---|---|---|
| `timeline[].level.{cat}.curr_rate` | Per filing | Absolute tone level (hits per 10K words) |
| `timeline[].level.{cat}.prev_rate` | Per filing | Previous filing's absolute level |
| `timeline[].delta.{cat}.rate` | Per filing | Delta between consecutive filings |
| `timeline[].delta.{cat}.z` | Per filing | Z-score of delta (global, across ALL doc types) |
| `category_series.{doc_type}.{cat}[]` | Pre-grouped | Time series of curr_rate + delta + z per doc type per category |
| `section_detail[].z_{cat}_doctype` | Per section | Z-score within doc type (solves annual/interim skew) |
| `timeline[].composite_delta` | Per filing | Weighted composite of all category deltas |
| `heatmap.{doc_type}[]` | Per doc type | Section × period matrix with all deltas |
| `drilldown.{id}.sections.{sec}` | Per comparison | Actual added/removed/modified sentences |
| `rankings.{cat}.top_increases/decreases` | Pre-computed | Top 5 biggest movers per category |
| `summary_stats` | Aggregate | Mean, std, min, max per category |

**Categories:** neg, pos, unc, lit, constr, modal_strong, modal_weak
**Doc types:** aif (4), annual_fs (4), annual_mda (4), interim_fs (14), interim_mda (14), mcr (8), news_release (88)

---

## Annual/Interim Skew Fix

**Problem:** The timeline z-scores (`delta.{cat}.z`) are computed across ALL doc types globally. An annual MD&A delta of +20 might be normal for annuals but extreme for interim. Mixing them distorts the signal.

**Solution:** Use `z_{cat}_doctype` from `section_detail` for heatmap/alerts. For the timeline views, compute doc-type-specific z-scores in the frontend:

```
For each doc_type:
  mean = avg of delta.{cat}.rate for that doc_type
  std = stddev of delta.{cat}.rate for that doc_type
  z_doctype = (delta.rate - mean) / std
```

This can be done once in `adaptSedarJson` and stored as `uz_dt`, `nz_dt`, etc. alongside the existing global z-scores.

---

## View Layout (5 sub-views, prioritized)

### VIEW 1: Price × Tone (default view)

**Purpose:** "Did disclosure tone changes predict or coincide with price moves?"

**Chart:** Dual-axis ComposedChart (same structure as current, refined)
- Left axis: Tone metric (bars) — user picks composite, neg, unc, pos, lit, constr
- Right axis: Weekly close price (line)
- X-axis: Filing period dates

**Refinements from current:**
- Add toggle: **Delta** (current) vs **Level** (absolute rate per 10K words)
  - Delta mode: bars = delta rate × 1000, colored red/green by sign
  - Level mode: area chart of `curr_rate` over time, overlaid with price line
- Doc type filter: default to **Interim MD&A** (not "All MD&A" — eliminates annual skew)
- Add a **Correlation table** below the chart showing Pearson r between tone metric and forward returns at various lags (1w, 2w, 4w, 8w, 12w). This exists for SI already — replicate the pattern.

**Data source:** `category_series.{selected_doc_type}.{selected_category}` for clean per-doc-type series, joined with `PRICE_DATA[sel]`.

### VIEW 2: Tone Levels

**Purpose:** "How much risk language does this company use right now vs its own history?"

**Chart:** Multi-line time series (one line per category)
- Y-axis: Hits per 10,000 words (absolute rate)
- X-axis: Filing period
- Lines: neg (red), unc (amber), lit (blue), constr (purple), pos (green)
- Shaded band: ±1σ from historical mean for each category

**Key insight this unlocks:** "NXE's uncertainty language has been declining from 215/10K in 2021 to 150/10K in 2025 — the company is getting more confident as it approaches production."

**Controls:**
- Doc type selector (default: Interim MD&A)
- Toggle individual categories on/off
- Optional: show `expansion_pct` as a secondary area to see if the filing is getting longer

**Data source:** `category_series.{doc_type}.{cat}[].curr_rate`

### VIEW 3: Tone Deltas (Z-Score View)

**Purpose:** "Which filing was abnormal for its doc type?"

**Chart:** Bar chart of z-scores (doc-type-specific) over time
- Y-axis: Z-score (doc-type-specific)
- X-axis: Filing period
- Reference lines at ±1.5 and ±2.0
- Color intensity scales with |z|: gray < 1, amber 1-1.5, orange 1.5-2, red > 2

**Stats bar above chart (keep current pattern):**
- Comparisons count
- Outliers |z| ≥ 1.5
- Latest spike (most recent outlier)
- Max risk increase / Max risk decrease

**Controls:**
- Doc type filter (default: Interim MD&A)
- Metric selector: composite, neg, unc, pos, lit, constr
- Sort: chronological vs by |z|

**Data source:** Timeline with doc-type-specific z computed in `adaptSedarJson`.

### VIEW 4: Section Heatmap

**Purpose:** "Where in the filing is the tone shifting?"

**Layout:** Matrix — rows = sections, columns = periods, cells colored by delta
- Cell color: diverging red-green by composite_delta (or selected metric)
- Cell tooltip: exact delta, z-score, expansion %, sentences added
- Click cell → expand to show `drilldown` sentences (added/removed/modified)

**Key insight:** "The risk_factors section of the AIF had a z=+2.3 spike in 2024 — what did they add?" → Click → see actual sentences.

**Controls:**
- Doc type selector
- Metric selector
- Sort sections by: max |delta|, alphabetical, or by most recent delta

**Data source:** `section_detail[]` filtered by doc_type, with `z_{cat}_doctype` for coloring. Drilldown from `drilldown.{comparison_id}.sections.{section}`.

### VIEW 5: Cross-Ticker Comparison

**Purpose:** "How does NXE's disclosure tone compare to GOLD.TO and TXG?"

**Chart:** Grouped bar or small multiples showing latest tone levels side-by-side
- For each category: 3 bars (NXE, GOLD.TO, TXG) showing `curr_rate` from most recent filing
- Below: sparkline of each ticker's tone level history

**Key insight:** "NXE uses 150 uncertainty words per 10K vs TXG's 90 — reflects pre-revenue vs producing status."

**Data source:** Load all 3 JSON files, extract `category_series.{doc_type}.{cat}` and show latest `curr_rate`. This view triggers loading all 3 JSONs regardless of selected ticker.

---

## Summary of Changes to `adaptSedarJson`

The transform function needs to extract much more from the raw JSON:

```
Return {
  timeline,          // existing, add doc-type z-scores
  alerts,            // existing
  heatmap,           // existing
  levels,            // NEW: category_series restructured for level charts
  sectionDetail,     // NEW: section_detail array with z_doctype fields
  rankings,          // NEW: pass through
  summaryStats,      // NEW: pass through
  drilldown,         // NEW: pass through (lazy-load?)
  meta,              // NEW: composite weights, doc types, etc.
}
```

---

## File Size Concern

The JSON files are 16-18MB each. The `drilldown` key (133 entries with full sentences) is probably 10MB+ of that. Options:
1. **Lazy load drilldown:** Split the JSON into `{ticker}_sedar.json` (core data, ~3MB) and `{ticker}_sedar_drilldown.json` (sentences, ~14MB). Only fetch drilldown when user clicks into a heatmap cell.
2. **Accept the size:** 16MB is large but cacheable. First load takes 2-3s on a good connection. Subsequent ticker switches are instant from cache.

Recommendation: **Option 1** if you can re-run `dashboard_prep.py` to split the output. Otherwise option 2 is fine for now.

---

## Implementation Order

1. Fix `adaptSedarJson` to extract all data fields (timeline + levels + sectionDetail + meta)
2. Compute doc-type-specific z-scores in frontend
3. Refine Price × Tone view (add level toggle, fix doc-type default to interim_mda)
4. Build Tone Levels view (new)
5. Refine Tone Deltas / Z-Score view (use doc-type z)
6. Enhance Section Heatmap (add drilldown click)
7. Build Cross-Ticker Comparison (last — requires loading all 3 JSONs)
