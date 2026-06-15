import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

// History Schedule grid: shows daily test results for every product / subproduct
// across a date range as a calendar-like grid of colored dots.
//
// IMPORTANT: this page only talks to existing API routes (no direct DB access):
//   - GET /api/getnewproductname            -> rows (mainProduct -> subProduct[])
//   - GET /api/getsummary?date=YYYY-MM-DD    -> cells (per-day results, one call per day)

type Flag = "all" | "fail" | "error" | "pass" | undefined;
type SubProduct = { name: string; flag?: Flag };
type Product = { mainProduct: string; subProduct?: SubProduct[] };

type NameTest = {
  name?: string;
  pass?: number;
  fail?: number;
  error?: number;
  time?: string;
};

type SummaryDoc = {
  date?: string;
  time?: string;
  mainproduct?: string;
  nametest?: NameTest[];
} | null;

// summaries[date][collectionName] = SummaryDoc
type SummaryByDate = Record<string, Record<string, SummaryDoc>>;

type CellStatus = "green" | "yellow" | "red" | "empty";
type Cell = {
  status: CellStatus;
  pass: number;
  fail: number;
  error: number;
  time?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Format a Date as a local YYYY-MM-DD string (no timezone shift). */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Inclusive list of YYYY-MM-DD keys from start to end. */
function buildDateRange(start: string, end: string, maxDays = 92): string[] {
  const s = keyToDate(start);
  const e = keyToDate(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return [];
  const out: string[] = [];
  const cur = new Date(s);
  while (cur <= e && out.length < maxDays) {
    out.push(toKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function computeCell(doc: SummaryDoc): Cell {
  if (!doc || !Array.isArray(doc.nametest) || doc.nametest.length === 0) {
    return { status: "empty", pass: 0, fail: 0, error: 0 };
  }
  let pass = 0;
  let fail = 0;
  let error = 0;
  for (const t of doc.nametest) {
    pass += typeof t?.pass === "number" ? t.pass : 0;
    fail += typeof t?.fail === "number" ? t.fail : 0;
    error += typeof t?.error === "number" ? t.error : 0;
  }
  let status: CellStatus = "green";
  if (fail > 0) status = "red";
  else if (error > 0) status = "yellow";
  return { status, pass, fail, error, time: doc.time };
}

type RangeOption = "2w" | "1m";

/** Compute the {startDate, endDate} keys for a range option ending today. */
function computeRange(option: RangeOption, base: Date) {
  const end = toKey(base);
  const start =
    option === "1m"
      ? toKey(new Date(base.getFullYear(), base.getMonth() - 1, base.getDate() + 1))
      : toKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - 13));
  return { startDate: start, endDate: end };
}

// Module-level cache: survives route changes within the SPA session so that
// returning to /history doesn't re-fetch. Cleared by the Refresh button.
type HistoryCache = {
  products?: Product[];
  latest?: Record<string, SummaryDoc>;
  summariesByRange: Record<string, SummaryByDate>;
  fetchedAt?: string;
};
const hsCache: HistoryCache =
  ((globalThis as any).__hsCache as HistoryCache) ??
  ((globalThis as any).__hsCache = { summariesByRange: {} });

export default function HistorySchedulePage() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  // Open the project's detail page (existing route /[mainproduct]/[subproduct]).
  const openDetail = (mainProduct: string, subName: string) =>
    router.push(
      `/${encodeURIComponent(mainProduct)}/${encodeURIComponent(subName)}`
    );

  // Date range is chosen via radio (2 weeks / 1 month) instead of pickers.
  const [rangeOption, setRangeOption] = useState<RangeOption>("2w");

  const { startDate, endDate } = useMemo(
    () => computeRange(rangeOption, today),
    [rangeOption, today]
  );
  const rangeKey = `${startDate}_${endDate}`;

  // Initialize from the module cache so a revisit renders instantly.
  const [products, setProducts] = useState<Product[]>(hsCache.products ?? []);
  const [summaries, setSummaries] = useState<SummaryByDate>(
    hsCache.summariesByRange[rangeKey] ?? {}
  );
  const [latest, setLatest] = useState<Record<string, SummaryDoc>>(
    hsCache.latest ?? {}
  );
  const [loading, setLoading] = useState(
    !(hsCache.products && hsCache.summariesByRange[rangeKey])
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>(hsCache.fetchedAt ?? "");
  const [refreshing, setRefreshing] = useState(false);
  // Bumped by the Refresh button to force both effects to re-fetch.
  const [reloadToken, setReloadToken] = useState(0);
  // Team filters. EMT = main product starts with "Z_"; SDP = everything else.
  const [showSDP, setShowSDP] = useState(true);
  const [showEMT, setShowEMT] = useState(true);

  const todayKey = useMemo(() => toKey(today), [today]);

  // Start of the "past week" window; a latest test older than this is stale.
  const weekAgo = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6),
    [today]
  );

  const dates = useMemo(
    () => buildDateRange(startDate, endDate),
    [startDate, endDate]
  );

  // Calendar columns are shown oldest-first (most recent date on the right).
  const displayDates = dates;

  // How many main products reference each subproduct collection. Used to safely
  // fall back to collection-level data when a collection maps 1:1 to a product
  // (handles case/whitespace mismatch in the stored `mainproduct` field).
  const subUsage = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      for (const s of p.subProduct || []) {
        m.set(s.name, (m.get(s.name) || 0) + 1);
      }
    }
    return m;
  }, [products]);

  // Load product structure + latest-result data. Served from cache on revisit;
  // re-fetched when the Refresh button bumps reloadToken.
  useEffect(() => {
    if (hsCache.products) {
      setProducts(hsCache.products);
      if (hsCache.latest) setLatest(hsCache.latest);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pRes, lRes] = await Promise.all([
          fetch(`/api/getnewproductname`),
          fetch(`/api/getlasttestdata`),
        ]);
        if (!pRes.ok) throw new Error(`getnewproductname: ${pRes.status}`);
        const pData = await pRes.json();
        const prods = (pData.products || []) as Product[];
        hsCache.products = prods;
        if (!cancelled) setProducts(prods);
        if (lRes.ok) {
          const lData = await lRes.json();
          const lmap = (lData.data || {}) as Record<string, SummaryDoc>;
          hsCache.latest = lmap;
          if (!cancelled) setLatest(lmap);
        }
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message ?? String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Load per-day summaries for the current range. Served from cache per range
  // key; re-fetched when the Refresh button bumps reloadToken.
  useEffect(() => {
    if (dates.length === 0) {
      setLoading(false);
      return;
    }
    const cached = hsCache.summariesByRange[rangeKey];
    if (cached) {
      setSummaries(cached);
      if (hsCache.fetchedAt) setFetchedAt(hsCache.fetchedAt);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    (async () => {
      try {
        const entries = await Promise.all(
          dates.map(async (date) => {
            const res = await fetch(`/api/getsummary?date=${date}`);
            if (!res.ok) throw new Error(`getsummary ${date}: ${res.status}`);
            const json = (await res.json()) as Record<string, SummaryDoc>;
            return [date, json] as const;
          })
        );
        if (cancelled) return;
        const next: SummaryByDate = {};
        for (const [date, json] of entries) next[date] = json;
        hsCache.summariesByRange[rangeKey] = next;
        hsCache.fetchedAt = new Date().toLocaleString();
        setSummaries(next);
        setFetchedAt(hsCache.fetchedAt);
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message ?? String(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, reloadToken]);

  // Clear the cache and re-fetch everything for the current range.
  const handleRefresh = () => {
    hsCache.products = undefined;
    hsCache.latest = undefined;
    hsCache.summariesByRange = {};
    hsCache.fetchedAt = undefined;
    setRefreshing(true);
    setReloadToken((t) => t + 1);
  };

  // Resolve a collection's document for a given main product from a
  // collection-keyed map (used for both the per-day grid and the latest column).
  function resolveDoc(
    map: Record<string, SummaryDoc> | undefined,
    mainProduct: string,
    subName: string
  ): SummaryDoc {
    if (!map) return null;
    const doc = map[subName];
    if (!doc) return null;
    const docMain = (doc.mainproduct || "").trim().toLowerCase();
    const rowMain = mainProduct.trim().toLowerCase();
    if (docMain === rowMain) return doc;
    // Collection used by a single product -> safe to use even if the stored
    // mainproduct label differs slightly. Shared collections require an exact
    // match, so return null to avoid showing another product's result.
    if ((subUsage.get(subName) || 0) <= 1) return doc;
    return null;
  }

  const getDoc = (mainProduct: string, subName: string, date: string) =>
    resolveDoc(summaries[date], mainProduct, subName);

  // EMT team owns projects whose main product starts with "Z_"; SDP owns the rest.
  const isEMT = (mainProduct: string) =>
    mainProduct.trim().toUpperCase().startsWith("Z_");

  // Rows actually rendered, after applying the team filters.
  const visibleProducts = useMemo(
    () =>
      products.filter((p) => (isEMT(p.mainProduct) ? showEMT : showSDP)),
    [products, showSDP, showEMT]
  );

  const totalRows = useMemo(
    () => visibleProducts.reduce((n, p) => n + (p.subProduct?.length || 0), 0),
    [visibleProducts]
  );

  // Count visible projects by the status of their *latest* test only:
  // green (all pass) / yellow (has error) / red (has fail), plus how many have
  // had no test at all within the past 7 days.
  const stats = useMemo(() => {
    let green = 0;
    let yellow = 0;
    let red = 0;
    let noTestWeek = 0;
    for (const p of visibleProducts) {
      for (const s of p.subProduct || []) {
        const doc = resolveDoc(latest, p.mainProduct, s.name);
        const cell = computeCell(doc);
        if (doc && doc.date && cell.status !== "empty") {
          if (cell.status === "red") red += 1;
          else if (cell.status === "yellow") yellow += 1;
          else green += 1;
          if (keyToDate(doc.date) < weekAgo) noTestWeek += 1;
        } else {
          noTestWeek += 1;
        }
      }
    }
    return { green, yellow, red, noTestWeek };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProducts, latest, weekAgo, subUsage]);

  return (
    <div className="hs-page">
      <header className="hs-header">
        <div className="hs-titlerow">
          <div>
            <h1>QA Test Grid &mdash; History Schedule</h1>
            <div className="hs-sub">
              ช่วงวันที่ {dates[0] ? keyToDate(dates[0]).toLocaleDateString("en-GB") : "-"}
              {" - "}
              {dates.length
                ? keyToDate(dates[dates.length - 1]).toLocaleDateString("en-GB")
                : "-"}
              {fetchedAt && (
                <>
                  {" "}&nbsp;|&nbsp; ดึงเมื่อ {fetchedAt}
                </>
              )}
              {" "}&nbsp;|&nbsp; {totalRows} subprojects &times; {dates.length} วัน
            </div>
          </div>
        </div>

        {/* Count of visible projects by their latest test status */}
        <div className="hs-stats">
          <span className="stat">สรุปผลล่าสุด ({totalRows} โปรเจค):</span>
          <span className="stat pass">
            <span className="dot green" /> ผ่าน {stats.green}
          </span>
          <span className="stat error">
            <span className="dot yellow" /> error {stats.yellow}
          </span>
          <span className="stat fail">
            <span className="dot red" /> fail {stats.red}
          </span>
          <span className="stat divider">|</span>
          <span className="stat nodata">
            ไม่มีผลเทสในรอบ 1 สัปดาห์: <b>{stats.noTestWeek}</b> โปรเจค
          </span>
        </div>

        <div className="hs-controls">
          <div className="hs-radio">
            <label>
              <input
                type="radio"
                name="range"
                checked={rangeOption === "2w"}
                onChange={() => setRangeOption("2w")}
              />
              2 สัปดาห์
            </label>
            <label>
              <input
                type="radio"
                name="range"
                checked={rangeOption === "1m"}
                onChange={() => setRangeOption("1m")}
              />
              1 เดือน
            </label>
          </div>
          <div className="hs-teams">
            <label className="hs-check">
              <input
                type="checkbox"
                checked={showSDP}
                onChange={(e) => setShowSDP(e.target.checked)}
              />
              SDP
            </label>
            <label className="hs-check">
              <input
                type="checkbox"
                checked={showEMT}
                onChange={(e) => setShowEMT(e.target.checked)}
              />
              EMT
            </label>
          </div>
          <button
            type="button"
            className="hs-refresh"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? "กำลังโหลด..." : "↻ Refresh"}
          </button>
        </div>
      </header>

      {errorMsg ? (
        <div className="hs-error">โหลดข้อมูลไม่สำเร็จ: {errorMsg}</div>
      ) : null}

      <div className="hs-wrap">
        {loading ? (
          <div className="hs-loading">กำลังโหลด...</div>
        ) : dates.length === 0 ? (
          <div className="hs-loading">ช่วงวันที่ไม่ถูกต้อง</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th className="corner1">Product</th>
                <th className="corner2">Subproject</th>
                <th className="corner3">Latest</th>
                {displayDates.map((d) => {
                  const dt = keyToDate(d);
                  const isToday = d === todayKey;
                  const isWeekStart = dt.getDay() === 1; // Monday -> divider on its left (Sun|Mon)
                  return (
                    <th
                      className={`d${isToday ? " today" : ""}${
                        isWeekStart ? " weekstart" : ""
                      }`}
                      key={d}
                    >
                      <div>
                        {String(dt.getDate()).padStart(2, "0")}/
                        {String(dt.getMonth() + 1).padStart(2, "0")}
                      </div>
                      <div className="wd">{isToday ? "Today" : WEEKDAYS[dt.getDay()]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => {
                const subs = p.subProduct || [];
                if (subs.length === 0) return null;
                return subs.map((sub, idx) => (
                  <tr
                    key={`${p.mainProduct}::${sub.name}`}
                    className="row-link"
                    onClick={() => openDetail(p.mainProduct, sub.name)}
                    title={`เปิดรายละเอียด ${p.mainProduct} / ${sub.name}`}
                  >
                    {idx === 0 && (
                      <th className="mp" rowSpan={subs.length}>
                        {p.mainProduct}
                      </th>
                    )}
                    <th className="sp" title={sub.name}>{sub.name}</th>
                    {(() => {
                      const lDoc = resolveDoc(latest, p.mainProduct, sub.name);
                      const lCell = computeCell(lDoc);
                      if (lCell.status === "empty" || !lDoc?.date) {
                        return <th className="latest empty">&mdash;</th>;
                      }
                      const ld = keyToDate(lDoc.date);
                      const stale = ld < weekAgo;
                      const title = `pass:${lCell.pass}  fail:${lCell.fail}  error:${lCell.error}${
                        lCell.time ? `  @ ${lCell.time}` : ""
                      }`;
                      return (
                        <th className="latest" title={title}>
                          <span className={`dot ${lCell.status}`} />
                          <span className="latest-date">
                            {String(ld.getDate()).padStart(2, "0")}/
                            {String(ld.getMonth() + 1).padStart(2, "0")}/
                            {ld.getFullYear()}
                          </span>
                          {stale && (
                            <span
                              className="latest-stale"
                              title="ไม่มีผลเทสในรอบ 1 สัปดาห์"
                            >
                              ?
                            </span>
                          )}
                        </th>
                      );
                    })()}
                    {displayDates.map((d) => {
                      const isToday = d === todayKey;
                      const isWeekStart = keyToDate(d).getDay() === 1;
                      const extra = `${isToday ? " today" : ""}${
                        isWeekStart ? " weekstart" : ""
                      }`;
                      const cell = computeCell(getDoc(p.mainProduct, sub.name, d));
                      if (cell.status === "empty") {
                        return <td className={`c empty${extra}`} key={d} />;
                      }
                      const title = `pass:${cell.pass}  fail:${cell.fail}  error:${cell.error}${
                        cell.time ? `  @ ${cell.time}` : ""
                      }`;
                      return (
                        <td className={`c${extra}`} key={d}>
                          <span className={`dot ${cell.status}`} title={title} />
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </div>

      <style jsx>{`
        .hs-page {
          margin-left: 16rem; /* leave room for the fixed sidebar (w-64) */
          background: #1f2733;
          color: #e6e8eb;
          min-height: 100vh;
        }
        .hs-header {
          padding: 16px 20px;
          background: #161c26;
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .hs-titlerow {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }
        h1 {
          margin: 0 0 4px;
          font-size: 20px;
        }
        .hs-sub {
          color: #9aa3af;
          font-size: 13px;
        }
        .hs-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .hs-controls label {
          display: flex;
          gap: 6px;
          align-items: center;
          font-size: 13px;
          color: #cfe;
        }
        .hs-radio {
          display: inline-flex;
          gap: 4px;
          background: #2a3340;
          border: 1px solid #3a4656;
          border-radius: 8px;
          padding: 3px;
        }
        .hs-radio label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          color: #cfe;
        }
        .hs-radio input {
          accent-color: #5b9bd5;
          cursor: pointer;
        }
        .hs-refresh {
          background: #2f6db0;
          color: #fff;
          border: 1px solid #3f7fc4;
          border-radius: 8px;
          padding: 6px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
        }
        .hs-refresh:hover {
          background: #357ec7;
        }
        .hs-refresh:disabled {
          background: #3a4656;
          border-color: #3a4656;
          color: #9aa3af;
          cursor: default;
        }
        .hs-teams {
          display: inline-flex;
          gap: 4px;
          background: #2a3340;
          border: 1px solid #3a4656;
          border-radius: 8px;
          padding: 3px;
        }
        .hs-check {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          color: #cfe;
        }
        .hs-check input {
          accent-color: #5b9bd5;
          cursor: pointer;
        }
        .hs-stats {
          margin-top: 10px;
          display: flex;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
          font-size: 13px;
          background: #1b2330;
          border: 1px solid #2c3744;
          border-radius: 8px;
          padding: 8px 14px;
        }
        .hs-stats .stat {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
        }
        .hs-stats .stat.pass {
          color: #8fde7c;
        }
        .hs-stats .stat.error {
          color: #ecec8c;
        }
        .hs-stats .stat.fail {
          color: #f79090;
        }
        .hs-stats .stat.divider {
          color: #3a4656;
          font-weight: 400;
        }
        .hs-stats .stat.nodata {
          color: #cdd4dd;
          font-weight: 500;
        }
        .hs-stats .stat.nodata b {
          color: #ffd27a;
          font-size: 14px;
        }
        .hs-error {
          margin: 12px 20px;
          padding: 10px 14px;
          background: #4a2530;
          color: #f7a8b0;
          border-radius: 6px;
          font-size: 13px;
        }
        .hs-loading {
          padding: 40px 20px;
          color: #9aa3af;
        }
        .hs-wrap {
          overflow: auto;
          max-height: calc(100vh - 120px);
        }
        table {
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }
        th,
        td {
          border-bottom: 1px solid #2c3744;
          border-right: 1px solid #2c3744;
          white-space: nowrap;
        }
        thead th {
          position: sticky;
          top: 0;
          background: #2a3340;
          z-index: 20;
          padding: 6px 8px;
          text-align: center;
        }
        th.d :global(.wd) {
          font-size: 10px;
          color: #8a93a0;
          font-weight: 400;
        }
        th.mp {
          position: sticky;
          left: 0;
          z-index: 15;
          background: #222b38;
          padding: 6px 10px;
          text-align: left;
          vertical-align: top;
          font-weight: 700;
          color: #cfe;
          border-right: 2px solid #3a4656;
        }
        th.sp {
          position: sticky;
          left: 120px;
          z-index: 15;
          background: #27313e;
          padding: 5px 10px;
          text-align: left;
          font-weight: 500;
          color: #dfe3e8;
          border-right: 2px solid #3a4656;
          width: 190px;
          max-width: 190px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        th.latest {
          position: sticky;
          left: 310px;
          z-index: 15;
          background: #232d3a;
          padding: 5px 10px;
          text-align: left;
          font-weight: 500;
          color: #dfe3e8;
          border-right: 2px solid #3a4656;
          width: 130px;
          min-width: 130px;
        }
        th.latest :global(.latest-date) {
          margin-left: 8px;
          font-size: 12px;
          color: #cdd4dd;
        }
        th.latest :global(.latest-stale) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          margin-left: 6px;
          border-radius: 50%;
          background: #ffd27a;
          color: #4a3500;
          font-size: 11px;
          font-weight: 700;
          vertical-align: middle;
          cursor: help;
        }
        th.latest.empty {
          color: #5b6573;
          font-weight: 400;
        }
        thead th.corner1 {
          position: sticky;
          left: 0;
          z-index: 25;
          width: 120px;
          background: #2a3340;
          text-align: left;
        }
        thead th.corner2 {
          position: sticky;
          left: 120px;
          z-index: 25;
          background: #2a3340;
          text-align: left;
        }
        thead th.corner3 {
          position: sticky;
          left: 310px;
          z-index: 25;
          background: #2a3340;
          text-align: left;
          border-right: 2px solid #3a4656;
        }
        /* Week divider: Monday's left edge marks the Sun|Mon boundary. */
        th.d.weekstart,
        td.c.weekstart {
          border-left: 2px solid #55657a;
        }
        th.d.today {
          background: #33414f;
        }
        /* Today highlight comes after weekstart so its border wins when both apply. */
        th.d.today,
        td.c.today {
          border-left: 3px solid #5b9bd5;
          border-right: 3px solid #5b9bd5;
        }
        td.c {
          text-align: center;
          padding: 4px 8px;
        }
        td.empty {
          background: #212a36;
        }
        .dot {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          vertical-align: middle;
          cursor: default;
        }
        .dot.green {
          background: #66c552;
        }
        .dot.yellow {
          background: #f0f06c;
        }
        .dot.red {
          background: #f77575;
        }
        tbody tr.row-link {
          cursor: pointer;
        }
        tbody tr:hover td {
          background: #283341;
        }
        tbody tr.row-link:hover th.mp {
          background: #2a3850;
        }
        tbody tr:hover th.sp,
        tbody tr:hover th.latest {
          background: #30404f;
        }
      `}</style>
    </div>
  );
}
