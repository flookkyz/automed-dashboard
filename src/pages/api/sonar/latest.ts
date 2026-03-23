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
  const overall = {
    bugs: toNumber(getMeasureValue(measures, "bugs")),
    vulnerabilities: toNumber(getMeasureValue(measures, "vulnerabilities")),
    codeSmells: toNumber(getMeasureValue(measures, "code_smells")),
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

    if (!projectKey) return res.status(400).json({ error: "projectKey query parameter is required" });

    const CACHE_TTL_MS = 15_000;
    const cacheKey = `sonar:${projectKey}:${branch || "(default)"}:${mainproduct || "(none)"}:${subproduct || "(none)"}`;

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

    const doc = await db.collection("sonar_latest").findOne(
      {
        projectKey,
        branch: branch || null,
        mainproduct: mainproduct || null,
        subproduct: subproduct || null,
      },
      { projection: { _id: 0 } },
    );

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
