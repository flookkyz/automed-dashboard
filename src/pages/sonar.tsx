import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import LoadingState from "../components/LoadingState";

type SonarSummary = {
  overall: {
    reliabilityIssues: number | null;
    securityIssues: number | null;
    maintainabilityIssues: number | null;
    bugs: number | null;
    vulnerabilities: number | null;
    codeSmells: number | null;
    securityHotspots: number | null;
    acceptedIssues: number | null;
    coverage: number | null;
    duplicatedLinesDensity: number | null;
    ncloc: number | null;
    reliabilityRating: string | null;
    securityRating: string | null;
    maintainabilityRating: string | null;
  };
  newCode: {
    newBugs: number | null;
    newVulnerabilities: number | null;
    newCodeSmells: number | null;
    newViolations: number | null;
    newSecurityHotspots: number | null;
    newAcceptedIssues: number | null;
    newCoverage: number | null;
    newDuplicatedLinesDensity: number | null;
    newLines: number | null;
  };
};

type SonarLatestPayload = {
  projectKey?: string;
  branch?: string | null;
  mainproduct?: string | null;
  subproduct?: string | null;
  scannedAt?: string;
  receivedAt?: string;
  dashboardUrl?: string | null;
  qualityGate?: { status?: string } | null;
  summary?: SonarSummary;
  newCodePeriod?: any;
};

function Card(props: { title: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="text-sm text-gray-500">{props.title}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{props.value}</div>
      {props.sub ? <div className="text-xs text-gray-500 mt-1">{props.sub}</div> : null}
    </div>
  );
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number | null): string {
  if (value === null) return "-";
  return String(value);
}

export default function SonarPage() {
  const router = useRouter();
  const q = router.query;

  const initialMain = typeof q.mainproduct === "string" ? q.mainproduct : "";
  const initialSub = typeof q.subproduct === "string" ? q.subproduct : "";
  const initialProjectKey = typeof q.projectKey === "string" ? q.projectKey : "";
  const initialBranch = typeof q.branch === "string" ? q.branch : "";

  const [projectKey, setProjectKey] = useState(initialProjectKey);
  const [branch, setBranch] = useState(initialBranch);
  const [mainproduct, setMainproduct] = useState(initialMain);
  const [subproduct, setSubproduct] = useState(initialSub);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SonarLatestPayload | null>(null);

  useEffect(() => {
    // Keep state in sync if user navigates from the sidebar with query params
    if (typeof q.projectKey === "string") setProjectKey(q.projectKey);
    if (typeof q.branch === "string") setBranch(q.branch);
    if (typeof q.mainproduct === "string") setMainproduct(q.mainproduct);
    if (typeof q.subproduct === "string") setSubproduct(q.subproduct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.projectKey, q.branch, q.mainproduct, q.subproduct]);

  const canLoad = useMemo(() => {
    return Boolean(projectKey.trim()) || (Boolean(mainproduct.trim()) && Boolean(subproduct.trim()));
  }, [projectKey, mainproduct, subproduct]);

  const load = async () => {
    if (!canLoad) {
      setError("Provide either Project Key, or both Mainproduct and Subproduct");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (projectKey.trim()) params.set("projectKey", projectKey.trim());
      if (branch.trim()) params.set("branch", branch.trim());
      if (mainproduct.trim()) params.set("mainproduct", mainproduct.trim());
      if (subproduct.trim()) params.set("subproduct", subproduct.trim());

      const resp = await fetch(`/api/sonar/latest?${params.toString()}`);
      const json = await resp.json();
      if (!resp.ok) {
        throw new Error(json?.error || `Request failed: ${resp.status}`);
      }

      setData(json);

      // Persist query in URL for shareability
      router.replace(
        {
          pathname: "/sonar",
          query: Object.fromEntries(params.entries()),
        },
        undefined,
        { shallow: true },
      );
    } catch (e: any) {
      setData(null);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load if navigated with params
    if (!router.isReady) return;
    if (!canLoad) return;
    // Avoid reloading on every keystroke; only auto-load once on entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  if (loading) {
    return (
      <div className="ml-64">
        <LoadingState variant="dashboard" label="Loading SonarQ results..." />
      </div>
    );
  }

  const summary = data?.summary;
  const qgStatus = data?.qualityGate?.status ?? null;

  return (
    <div className="ml-64 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SonarQ Results</h1>
          <div className="text-sm text-gray-600 mt-1">
            {data?.projectKey ? <span>Project: {data.projectKey}</span> : <span>Project: -</span>}
            {data?.branch ? <span> • Branch: {data.branch}</span> : null}
            {data?.mainproduct && data?.subproduct ? (
              <span>
                {" "}
                • {data.mainproduct} &gt; {data.subproduct}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {data?.scannedAt ? <span>Scanned: {new Date(data.scannedAt).toLocaleString()}</span> : null}
            {data?.receivedAt ? <span> • Received: {new Date(data.receivedAt).toLocaleString()}</span> : null}
          </div>
        </div>

        {data?.dashboardUrl ? (
          <a
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
            href={data.dashboardUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open in SonarQube
          </a>
        ) : null}
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600">Project Key</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. automed-dashboard"
              value={projectKey}
              onChange={(e) => setProjectKey(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Branch (optional)</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. master"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Mainproduct (optional)</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. AUTOMED"
              value={mainproduct}
              onChange={(e) => setMainproduct(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Subproduct (optional)</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              placeholder="e.g. automed-dashboard-ui"
              value={subproduct}
              onChange={(e) => setSubproduct(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-600">
            {qgStatus ? (
              <span>
                Quality Gate: <span className="font-semibold">{qgStatus}</span>
              </span>
            ) : (
              <span>Quality Gate: -</span>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
            onClick={load}
            disabled={!canLoad}
          >
            Load
          </button>
        </div>
        {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
      </div>

      {summary ? (
        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Overall Code</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card
                title="Reliability"
                value={formatNumber(summary.overall.reliabilityIssues ?? summary.overall.bugs)}
                sub={summary.overall.reliabilityRating ? `Rating ${summary.overall.reliabilityRating}` : undefined}
              />
              <Card
                title="Security"
                value={formatNumber(summary.overall.securityIssues ?? summary.overall.vulnerabilities)}
                sub={summary.overall.securityRating ? `Rating ${summary.overall.securityRating}` : undefined}
              />
              <Card
                title="Maintainability"
                value={formatNumber(summary.overall.maintainabilityIssues ?? summary.overall.codeSmells)}
                sub={summary.overall.maintainabilityRating ? `Rating ${summary.overall.maintainabilityRating}` : undefined}
              />
              <Card title="Security Hotspots" value={formatNumber(summary.overall.securityHotspots)} />
              <Card title="Coverage" value={formatPercent(summary.overall.coverage)} />
              <Card title="Duplications" value={formatPercent(summary.overall.duplicatedLinesDensity)} />
              <Card title="NCLOC" value={formatNumber(summary.overall.ncloc)} />
              <Card title="Accepted Issues" value={formatNumber(summary.overall.acceptedIssues)} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-3">New Code</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card title="Reliability" value={formatNumber(summary.newCode.newBugs)} sub="New bugs" />
              <Card title="Security" value={formatNumber(summary.newCode.newVulnerabilities)} sub="New vulnerabilities" />
              <Card title="Maintainability" value={formatNumber(summary.newCode.newCodeSmells)} sub="New code smells" />
              <Card title="Security Hotspots" value={formatNumber(summary.newCode.newSecurityHotspots)} />
              <Card title="Coverage" value={formatPercent(summary.newCode.newCoverage)} />
              <Card title="Duplications" value={formatPercent(summary.newCode.newDuplicatedLinesDensity)} />
              <Card title="Lines" value={formatNumber(summary.newCode.newLines)} />
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="mt-6 text-sm text-gray-600">No summary metrics found in stored payload.</div>
      ) : null}
    </div>
  );
}
