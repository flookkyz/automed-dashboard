import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Dashboard from "../../components/Dashboard";

type SonarDoc = {
  mainproduct?: string;
  subproduct?: string;
  projectKey?: string;
  branch?: string | null;
  scannedAt?: string;
  analysisId?: string | null;
  qualityGate?: any;
  measures?: any;
  newCodePeriod?: any;
  issueCounts?: any;
  timestamp?: string;
  date?: string;
  time?: string;
};

// --- Utility functions ---

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normalizePercent(value: unknown): string {
  return `${toNumber(value).toFixed(1)}%`;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function hoursAgo(iso: string | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const h = Math.max(0, Math.round((Date.now() - t) / (1000 * 60 * 60)));
  return `${h} hours ago`;
}

function buildMeasureMap(measures: any): Record<string, any> {
  if (!measures) return {};
  const list: any[] = Array.isArray(measures)
    ? measures
    : Array.isArray(measures.measures)
    ? measures.measures
    : [];
  const out: Record<string, any> = {};
  for (const m of list) {
    if (m && typeof m.metric === "string") {
      const value = m.value !== undefined
        ? m.value
        : m.period?.value !== undefined
        ? m.period.value
        : undefined;
      out[m.metric] = value === undefined ? m : { ...m, value };
    }
  }
  return out;
}

function issueTotalOrUndefined(value: unknown): number | undefined {
  const direct = toNumberOrUndefined(value);
  if (direct !== undefined) return direct;
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  if (!s.startsWith("{")) return undefined;
  try {
    return toNumberOrUndefined(JSON.parse(s)?.total);
  } catch {
    return undefined;
  }
}

function pickFirstDefinedNumber(...values: unknown[]): number {
  for (const v of values) {
    const n = toNumberOrUndefined(v);
    if (n !== undefined) return n;
  }
  return 0;
}

// --- Sub-components ---

function QualityBadge({ status }: { status?: string }) {
  const s = String(status ?? "").toUpperCase();
  const isOk = s === "OK" || s === "PASSED";
  const label = isOk ? "Passed" : s ? "Failed" : "Unknown";
  const badgeClass = isOk
    ? "bg-green-700/30 text-green-200 border-green-700/50"
    : "bg-red-700/30 text-red-200 border-red-700/50";
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-sm font-semibold ${badgeClass}`}>
      {label}
    </span>
  );
}

function MetricCard({ title, value, sub }: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-600/60 bg-[#364153] p-4">
      <div className="text-sm text-gray-300">{title}</div>
      <div className="mt-1 text-2xl font-bold text-white">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-300">{sub}</div>}
    </div>
  );
}

// --- SonarQube panel ---

function SonarQubePanel({ mainproduct, subproduct }: { mainproduct: string; subproduct: string }) {
  const [tab, setTab] = useState<"new" | "overall">("new");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<SonarDoc | null>(null);

  useEffect(() => {
    if (!mainproduct || !subproduct) return;
    let mounted = true;

    const fetchSonar = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(
          `/api/getsonarqdata?mainproduct=${encodeURIComponent(mainproduct)}&subproduct=${encodeURIComponent(subproduct)}`,
        );
        if (!resp.ok) {
          if (resp.status === 404) {
            if (mounted) setDoc(null);
            return;
          }
          const txt = await resp.text();
          throw new Error(txt || `Request failed: ${resp.status}`);
        }
        const json = (await resp.json()) as SonarDoc;
        if (mounted) setDoc(json);
      } catch (e: any) {
        if (mounted) setError(e?.message ? String(e.message) : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchSonar();
    return () => { mounted = false; };
  }, [mainproduct, subproduct]);

  const measureMap = useMemo(() => buildMeasureMap(doc?.measures), [doc]);

  const { qgStatus, failedConditions, newCodeSince } = useMemo(() => {
    const qg = doc?.qualityGate;
    const conditions: any[] = Array.isArray(qg?.conditions) ? qg.conditions : [];
    const failed = conditions.filter((c) => String(c?.status ?? "").toUpperCase() === "ERROR").length;

    const ncp = doc?.newCodePeriod;
    let since = "";
    if (ncp) {
      if (typeof ncp === "string") {
        since = ncp;
      } else {
        const type = ncp.type ? String(ncp.type) : "";
        const value = ncp.value != null ? String(ncp.value) : "";
        since = type && value ? `${type}: ${value}` : value;
      }
    }

    return { qgStatus: qg?.status, failedConditions: failed, newCodeSince: since };
  }, [doc]);

  const metrics = useMemo(() => {
    const isN = tab === "new";
    const ic = doc?.issueCounts;
    return {
      issues: isN
        ? toNumber(measureMap.new_issues?.value ?? measureMap.new_violations?.value)
        : toNumber(measureMap.violations?.value ?? 0),
      accepted: isN
        ? toNumber(measureMap.new_accepted_issues?.value)
        : toNumber(measureMap.accepted_issues?.value),
      coverage: isN
        ? normalizePercent(measureMap.new_coverage?.value)
        : normalizePercent(measureMap.coverage?.value),
      dup: isN
        ? normalizePercent(measureMap.new_duplicated_lines_density?.value)
        : normalizePercent(measureMap.duplicated_lines_density?.value),
      securityHotspots: isN
        ? toNumber(measureMap.new_security_hotspots?.value)
        : toNumber(measureMap.security_hotspots?.value),
      reliabilityIssues: pickFirstDefinedNumber(
        issueTotalOrUndefined(measureMap.reliability_issues?.value),
        ic?.bugs,
        measureMap.bugs?.value,
      ),
      securityIssues: pickFirstDefinedNumber(
        issueTotalOrUndefined(measureMap.security_issues?.value),
        ic?.vulnerabilities,
        measureMap.vulnerabilities?.value,
      ),
      maintainabilityIssues: pickFirstDefinedNumber(
        issueTotalOrUndefined(measureMap.maintainability_issues?.value),
        ic?.codeSmells,
        measureMap.code_smells?.value,
      ),
      securityHotspotsOverall: pickFirstDefinedNumber(
        ic?.securityHotspots,
        measureMap.security_hotspots?.value,
      ),
    };
  }, [measureMap, tab, doc]);

  const isNew = tab === "new";

  return (
    <div className="mt-8 px-6 pb-10">
      <div className="rounded-lg border border-gray-600/60 bg-[#2c3443]">
        <div className="flex items-center justify-between border-b border-gray-600/60 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold text-white">Quality Gate</div>
              <QualityBadge status={qgStatus} />
            </div>
            <div className="mt-1 text-sm text-gray-300">
              {failedConditions ? `${failedConditions} conditions failed` : ""}
              {failedConditions && newCodeSince ? " • " : ""}
              {newCodeSince ? `New Code Since ${newCodeSince}` : ""}
            </div>
          </div>
          <div className="text-sm text-gray-300">
            {doc?.scannedAt ? `Last analysis ${hoursAgo(doc.scannedAt)}` : ""}
          </div>
        </div>

        <div className="px-6 pt-4">
          <div className="flex gap-2">
            {(["new", "overall"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-md px-4 py-2 text-sm font-semibold border ${
                  tab === t
                    ? "bg-[#364153] text-white border-gray-500"
                    : "bg-transparent text-gray-300 border-transparent"
                }`}
              >
                {t === "new" ? "New Code" : "Overall Code"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-6">
          {loading ? (
            <div className="text-gray-300">Loading SonarQube results...</div>
          ) : error ? (
            <div className="text-red-300">Error: {error}</div>
          ) : !doc ? (
            <div className="text-gray-300">No SonarQube data found for this subproduct.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="New issues" value={metrics.issues} sub={isNew ? "Required = 0" : undefined} />
              <MetricCard title="Accepted issues" value={metrics.accepted} sub="Valid issues that were not fixed" />
              <MetricCard title="Coverage" value={metrics.coverage} sub={isNew ? "Required ≥ 80.0%" : undefined} />
              <MetricCard title="Duplications" value={metrics.dup} sub={isNew ? "Required ≤ 3.0%" : undefined} />
              <MetricCard title="Security Hotspots" value={isNew ? metrics.securityHotspots : metrics.securityHotspotsOverall} />
              {!isNew && (
                <>
                  <MetricCard title="Reliability issues" value={metrics.reliabilityIssues} />
                  <MetricCard title="Security issues" value={metrics.securityIssues} />
                  <MetricCard title="Maintainability issues" value={metrics.maintainabilityIssues} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Page ---

const DataPage = () => {
  const router = useRouter();
  const mainproduct = typeof router.query.mainproduct === "string" ? router.query.mainproduct : "";
  const subproduct = typeof router.query.subproduct === "string" ? router.query.subproduct : "";

  return (
    <div className="ml-64">
      <Dashboard mainproduct={mainproduct} subproduct={subproduct} />
      {mainproduct && subproduct && (
        <SonarQubePanel mainproduct={mainproduct} subproduct={subproduct} />
      )}
    </div>
  );
};

export default DataPage;
