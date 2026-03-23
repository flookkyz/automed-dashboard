import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../../lib/mongodb";

type CacheEntry = { expiresAt: number; value: any };

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function ratingLetter(value: number | null): string | null {
  if (value === null) return null;
  // Sonar ratings: 1=A ... 5=E (string or number)
  const rounded = Math.round(value);
  const map: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
  return map[rounded] ?? null;
}

function getMeasureValue(measures: any[] | null | undefined, metric: string): string | null {
  if (!Array.isArray(measures)) return null;
  const item = measures.find((m) => m && m.metric === metric);
  const v = item?.value;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function buildSummaryFromMeasures(measures: any[] | null | undefined) {
  const reliabilityIssues = toNumber(getMeasureValue(measures, "reliability_issues"));
  const securityIssues = toNumber(getMeasureValue(measures, "security_issues"));
  const maintainabilityIssues = toNumber(getMeasureValue(measures, "maintainability_issues"));

  const bugs = toNumber(getMeasureValue(measures, "bugs"));
  const vulnerabilities = toNumber(getMeasureValue(measures, "vulnerabilities"));
  const codeSmells = toNumber(getMeasureValue(measures, "code_smells"));

  const overall = {
    // Match Sonar UI cards ("Reliability/Security/Maintainability open issues")
    reliabilityIssues: reliabilityIssues ?? bugs,
    securityIssues: securityIssues ?? vulnerabilities,
    maintainabilityIssues: maintainabilityIssues ?? codeSmells,

    // Keep raw/legacy metrics too
    bugs,
    vulnerabilities,
    codeSmells,
    securityHotspots: toNumber(getMeasureValue(measures, "security_hotspots")),
    acceptedIssues: toNumber(getMeasureValue(measures, "accepted_issues")),
    coverage: toNumber(getMeasureValue(measures, "coverage")),
    duplicatedLinesDensity: toNumber(getMeasureValue(measures, "duplicated_lines_density")),
    ncloc: toNumber(getMeasureValue(measures, "ncloc")),
    reliabilityRating: ratingLetter(toNumber(getMeasureValue(measures, "reliability_rating"))),
    securityRating: ratingLetter(toNumber(getMeasureValue(measures, "security_rating"))),
    maintainabilityRating: ratingLetter(toNumber(getMeasureValue(measures, "sqale_rating"))),
  };

  const newCode = {
    // Prefer domain-specific new code metrics (matches Sonar UI's New Code tab)
    newBugs: toNumber(getMeasureValue(measures, "new_bugs")),
    newVulnerabilities: toNumber(getMeasureValue(measures, "new_vulnerabilities")),
    newCodeSmells: toNumber(getMeasureValue(measures, "new_code_smells")),

    // Some Sonar versions expose "new_issues" while older ones use "new_violations".
    // As a final fallback, derive from the three domain-specific metrics.
    newIssues:
      toNumber(getMeasureValue(measures, "new_issues")) ??
      toNumber(getMeasureValue(measures, "new_violations")) ??
      (() => {
        const parts = [
          toNumber(getMeasureValue(measures, "new_bugs")),
          toNumber(getMeasureValue(measures, "new_vulnerabilities")),
          toNumber(getMeasureValue(measures, "new_code_smells")),
        ].filter((n) => typeof n === "number") as number[];
        return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
      })(),

    // Keep existing fields (some Sonar instances expose these)
    newViolations: toNumber(getMeasureValue(measures, "new_violations")),
    newSecurityHotspots: toNumber(getMeasureValue(measures, "new_security_hotspots")),
    newAcceptedIssues: toNumber(getMeasureValue(measures, "new_accepted_issues")),
    newCoverage: toNumber(getMeasureValue(measures, "new_coverage")),
    newDuplicatedLinesDensity: toNumber(getMeasureValue(measures, "new_duplicated_lines_density")),
    newLines: toNumber(getMeasureValue(measures, "new_lines")),
  };

  return { overall, newCode };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const projectKey = typeof req.query.projectKey === "string" ? req.query.projectKey.trim() : "";
    const branch = typeof req.query.branch === "string" ? req.query.branch.trim() : "";
    const mainproduct = typeof req.query.mainproduct === "string" ? req.query.mainproduct.trim() : "";
    const subproduct = typeof req.query.subproduct === "string" ? req.query.subproduct.trim() : "";

    const hasProductFields = Boolean(mainproduct) || Boolean(subproduct);
    if (hasProductFields && (!mainproduct || !subproduct)) {
      return res.status(400).json({
        error: "Both mainproduct and subproduct are required when providing product info",
      });
    }

    if (!projectKey && !(mainproduct && subproduct)) {
      return res.status(400).json({
        error: "Provide either projectKey, or both mainproduct and subproduct",
      });
    }

    const CACHE_TTL_MS = 15_000;
    const cacheKey = `sonar:${projectKey || "(by-product)"}:${branch || "(any)"}:${mainproduct || "(none)"}:${subproduct || "(none)"}`;

    const globalAny = globalThis as any;
    const cache: Map<string, CacheEntry> =
      globalAny.__automed_sonar_latest_cache ?? (globalAny.__automed_sonar_latest_cache = new Map());

    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
      return res.status(200).json(cached.value);
    }

    const client = await clientPromise;
    const db = client.db("automedtest-dashboard");

    const filter: any = {};
    if (projectKey) filter.projectKey = projectKey;
    if (branch) filter.branch = branch;
    if (mainproduct && subproduct) {
      filter.mainproduct = mainproduct;
      filter.subproduct = subproduct;
    }

    const doc = await db.collection("sonar_latest").findOne(filter, {
      projection: { _id: 0 },
      sort: { receivedAt: -1 },
    });

    if (!doc) {
      return res.status(404).json({ error: "No data" });
    }

    const measuresArray = Array.isArray(doc.measures)
      ? doc.measures
      : Array.isArray(doc.measures?.component?.measures)
        ? doc.measures.component.measures
        : null;

    const summary = buildSummaryFromMeasures(measuresArray);

    const payload = {
      ...doc,
      summary,
    };

    cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, value: payload });
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (error: any) {
    return res.status(500).json({ error: "Internal Server Error", message: error?.message ?? String(error) });
  }
}
