# Deploy SedarSentiment Component

## Overview
Replace the entire SEDAR sentiment tab in App.jsx with a new standalone component (`SedarSentiment.jsx`). The new component handles its own data transform, state, and rendering. App.jsx just passes the raw JSON and price data through.

## Files to add
Place the attached `SedarSentiment.jsx` in `blog-app/src/SedarSentiment.jsx`.

## Changes to `blog-app/src/App.jsx`

### 1. Add import (top of file, after existing imports)
```js
import SedarSentiment from "./SedarSentiment.jsx";
```

### 2. Remove SEDAR state variables (around lines 293-296)
Delete these lines:
```js
const [sedarDocType, setSedarDocType] = useState("all_mda");
const [sedarMetric, setSedarMetric] = useState("composite");
const [sedarView, setSedarView] = useState("priceCorr");
const [sedarSort, setSedarSort] = useState({ col: "period", asc: true });
```
These are now managed inside `SedarSentiment.jsx`.

### 3. Replace the entire SEDAR sentiment tab block
Find the block between these comments/lines:
```
{/* ════════════════ SEDAR SENTIMENT ════════════════ */}
{tab === "sedar sentiment" && ...
```
This spans from approximately line 747 to line 1375 (both the `sel === "NXE"` block and the `sel !== "NXE"` fallback).

Replace that entire block with:
```jsx
{/* ════════════════ SEDAR SENTIMENT ════════════════ */}
{tab === "sedar sentiment" && (() => {
  if (sedarLoading) {
    return (
      <Card style={{ marginBottom: 12, textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Loading SEDAR sentiment data…</div>
        <div style={{ fontSize: 9, color: C.dm }}>Fetching {sedarTicker} filing analysis...</div>
      </Card>
    );
  }
  if (sedarError) {
    return (
      <Card style={{ marginBottom: 12, textAlign: "center", padding: 30 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Couldn't load SEDAR sentiment data.</div>
        <div style={{ fontSize: 9, color: C.r }}>{sedarError.message}</div>
      </Card>
    );
  }
  return (
    <SedarSentiment
      rawJson={sedarRaw}
      priceData={PRICE_DATA[sel]}
      ticker={sel}
      tickerDisplay={sel === "GOLD" ? "GOLD.TO" : sel}
    />
  );
})()}
```

### 4. Keep the overview tab's SEDAR widget as-is
The overview tab (around lines 386-440) uses `sedarData.timeline` with the old compact format (`.dt`, `.p`, `.cz`). Keep the existing `adaptSedarJson` function and `sedarData` variable — they're still used by the overview widget. The new `SedarSentiment` component does its own richer transform internally from `sedarRaw`.

### 5. Keep existing fetch infrastructure as-is
Keep these lines unchanged — they handle fetching the raw JSON:
```js
const sedarTicker = sel === "GOLD" ? "GOLD.TO" : sel;
const sedarFile = SEDAR_FILES[sedarTicker];
const sedarUrl = sedarFile ? assetUrl(sedarFile) : null;
const sedarEnabled = ...;
const { data: sedarRaw, loading: sedarLoading, error: sedarError } = useJson(sedarUrl, { enabled: sedarEnabled });
const sedarData = useMemo(() => adaptSedarJson(sedarRaw), [sedarRaw]);
```

## Summary of what changes
- **New file:** `blog-app/src/SedarSentiment.jsx` (934 lines)
- **App.jsx changes:** Add 1 import, remove 4 state lines, replace ~625 lines of inline SEDAR rendering with ~20 lines that delegate to the new component
- **No other files change**

## Commit message
"Refactor: extract SEDAR sentiment into standalone component with 5 views"
