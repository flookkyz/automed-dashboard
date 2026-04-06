import type { GetServerSideProps } from "next";
import clientPromise from "../../lib/mongodb";

function formatDateForFilename(date: string): string {
  return date.replace(/[^0-9-]/g, "");
}

function safeFilenamePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "");
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function issueTotalOrNull(value: unknown): number | null {
  const direct = toNumberOrNull(value);
  if (direct !== null) return direct;
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s.startsWith("{")) return null;
  try {
    const obj = JSON.parse(s);
    return toNumberOrNull(obj?.total);
  } catch {
    return null;
  }
}

function buildMeasureMap(measures: any): Record<string, any> {
  const list = Array.isArray(measures) ? measures : Array.isArray(measures?.measures) ? measures.measures : [];
  const out: Record<string, any> = {};
  for (const m of list) {
    if (!m || typeof m.metric !== "string") continue;
    const normalizedValue =
      m.value !== undefined ? m.value : m.period && m.period.value !== undefined ? m.period.value : undefined;
    out[m.metric] = normalizedValue === undefined ? m : { ...m, value: normalizedValue };
  }
  return out;
}

function pickFirstNumberOrNull(...values: unknown[]): number | null {
  for (const v of values) {
    const n = toNumberOrNull(v);
    if (n !== null) return n;
  }
  return null;
}

function asPercent(value: number | null, digits = 1): string {
  if (value === null) return "-";
  return `${value.toFixed(digits)}%`;
}

export const getServerSideProps: GetServerSideProps = async ({ query, res }) => {
  const mainproduct = typeof query.mainproduct === "string" ? query.mainproduct : "";
  const subproduct = typeof query.subproduct === "string" ? query.subproduct : "";
  const date = typeof query.date === "string" ? query.date : "";

  if (!subproduct) {
    const templateLines: string[] = [];
    templateLines.push("GitLab CI - SonarQube scan job template");
    templateLines.push("==================================");
    templateLines.push("");
    templateLines.push("1) Set GitLab CI/CD Variables (masked/protected where appropriate):");
    templateLines.push("- SONAR_HOST_URL");
    templateLines.push("- SONAR_PROJECT_KEY");
    templateLines.push("- SONAR_TOKEN");
    templateLines.push("- MAINPRODUCT");
    templateLines.push("- SUBPRODUCT");
    templateLines.push("- DASHBOARD_API_URL   (optional)  e.g. http://10.22.26.77:3030");
    templateLines.push("");
    templateLines.push("2) Copy this into .gitlab-ci.yml:");
    templateLines.push("");

    templateLines.push(
      [
        "sonarqube:",
        "  stage: sonarqube_scan",
        "  image:",
        "    name: sonarsource/sonar-scanner-cli:latest",
        "  tags:",
        "    - automedtest-dashboard",
        "  script:",
        "    - |",
        "      if ! command -v curl >/dev/null 2>&1; then",
        "        if command -v apk >/dev/null 2>&1; then",
        "          apk add --no-cache curl",
        "        elif command -v apt-get >/dev/null 2>&1; then",
        "          apt-get update -y && apt-get install -y curl",
        "        elif command -v yum >/dev/null 2>&1; then",
        "          yum install -y curl",
        "        elif command -v dnf >/dev/null 2>&1; then",
        "          dnf install -y curl",
        "        elif command -v microdnf >/dev/null 2>&1; then",
        "          microdnf install -y curl",
        "        fi",
        "      fi",
        "    - |",
        "      set -eu",
        "",
        "      required_env() {",
        "        name=\"$1\"",
        "        eval \"value=\\${$name:-}\"",
        "        if [ -z \"$value\" ]; then",
        "          echo \"Missing required env: $name\" >&2",
        "          exit 2",
        "        fi",
        "      }",
        "",
        "      required_env SONAR_HOST_URL",
        "      required_env SONAR_PROJECT_KEY",
        "      required_env SONAR_TOKEN",
        "      required_env MAINPRODUCT",
        "      required_env SUBPRODUCT",
        "",
        "      SONAR_SOURCES=\"${SONAR_SOURCES:-.}\"",
        "      SONAR_METADATA_FILE=\"${SONAR_METADATA_FILE:-$(pwd)/report-task.txt}\"",
        "      SONAR_OUT_FILE=\"${SONAR_OUT_FILE:-sonar-summary.json}\"",
        "      DASHBOARD_API_URL=\"${DASHBOARD_API_URL:-}\"",
        "      DASHBOARD_SONAR_PATH=\"${DASHBOARD_SONAR_PATH:-/api/addsonarqdata}\"",
        "      SONAR_BRANCH=\"${SONAR_BRANCH:-${CI_COMMIT_BRANCH:-master}}\"",
        "",
        "      node_json_get() {",
        "        json_input=\"$1\"",
        "        js_expr=\"$2\"",
        "        printf '%s' \"$json_input\" | \"$NODE_BIN\" -e \"const fs=require('fs'); const j=JSON.parse(fs.readFileSync(0,'utf8')); const v=(${js_expr}); if (v===undefined||v===null) process.exit(0); if (typeof v==='object') { process.stdout.write(JSON.stringify(v)); } else { process.stdout.write(String(v)); }\"",
        "      }",
        "",
        "      sonar-scanner \\",
        "        -Dsonar.projectKey=\"$SONAR_PROJECT_KEY\" \\",
        "        -Dsonar.sources=\"$SONAR_SOURCES\" \\",
        "        -Dsonar.host.url=\"$SONAR_HOST_URL\" \\",
        "        -Dsonar.token=\"$SONAR_TOKEN\" \\",
        "        -Dsonar.scanner.metadataFilePath=\"$SONAR_METADATA_FILE\"",
        "",
        "      NODE_BIN=\"/opt/sonar-scanner/.sonar/js/node-runtime/node\"",
        "      if [ ! -x \"$NODE_BIN\" ]; then",
        "        NODE_BIN=\"$(command -v node || true)\"",
        "      fi",
        "      if [ -z \"$NODE_BIN\" ] || [ ! -x \"$NODE_BIN\" ]; then",
        "        echo \"Node.js runtime not found (needed to parse SonarQube JSON).\" >&2",
        "        exit 6",
        "      fi",
        "",
        "      CE_TASK_ID=\"$(grep '^ceTaskId=' \"$SONAR_METADATA_FILE\" | cut -d= -f2 || true)\"",
        "      if [ -z \"$CE_TASK_ID\" ]; then",
        "        echo \"Could not read ceTaskId from $SONAR_METADATA_FILE\" >&2",
        "        exit 3",
        "      fi",
        "",
        "      echo \"Waiting for SonarQube task: $CE_TASK_ID\" >&2",
        "",
        "      CE_JSON=\"\"",
        "      STATUS=\"\"",
        "      ANALYSIS_ID=\"\"",
        "",
        "      attempt=0",
        "      while [ \"$attempt\" -lt 60 ]; do",
        "        CE_JSON=\"$(curl -sS -u \"$SONAR_TOKEN:\" \"$SONAR_HOST_URL/api/ce/task?id=$CE_TASK_ID\")\"",
        "        STATUS=\"$(node_json_get \"$CE_JSON\" 'j.task && j.task.status')\"",
        "        ANALYSIS_ID=\"$(node_json_get \"$CE_JSON\" 'j.task && j.task.analysisId')\"",
        "",
        "        if [ \"$STATUS\" = \"SUCCESS\" ] && [ -n \"$ANALYSIS_ID\" ]; then",
        "          break",
        "        fi",
        "",
        "        if [ \"$STATUS\" = \"FAILED\" ] || [ \"$STATUS\" = \"CANCELED\" ]; then",
        "          echo \"$CE_JSON\" >&2",
        "          exit 4",
        "        fi",
        "",
        "        attempt=$((attempt + 1))",
        "        sleep 5",
        "      done",
        "",
        "      if [ \"$STATUS\" != \"SUCCESS\" ]; then",
        "        echo \"Timed out waiting for SonarQube task ($CE_TASK_ID). Last status: $STATUS\" >&2",
        "        echo \"$CE_JSON\" >&2",
        "        exit 5",
        "      fi",
        "",
        "      QUALITY_GATE_JSON=\"$(curl -sS -u \"$SONAR_TOKEN:\" \"$SONAR_HOST_URL/api/qualitygates/project_status?analysisId=$ANALYSIS_ID\")\"",
        "",
        "      METRICS=\"bugs,vulnerabilities,code_smells,security_hotspots,coverage,duplicated_lines_density,reliability_issues,security_issues,maintainability_issues,accepted_issues,violations,new_bugs,new_vulnerabilities,new_code_smells,new_security_hotspots,new_coverage,new_duplicated_lines_density,new_reliability_issues,new_security_issues,new_maintainability_issues,new_accepted_issues,new_violations\"",
        "      MEASURES_RAW=\"$(curl -sS -u \"$SONAR_TOKEN:\" \"$SONAR_HOST_URL/api/measures/component?component=$SONAR_PROJECT_KEY&branch=$SONAR_BRANCH&metricKeys=$METRICS\")\"",
        "      CE_TASK_JSON=\"$CE_JSON\"",
        "",
        "      QUALITY_GATE_STATUS=\"$(node_json_get \"$QUALITY_GATE_JSON\" 'j.projectStatus && j.projectStatus.status')\"",
        "      QUALITY_GATE_CONDITIONS=\"$(node_json_get \"$QUALITY_GATE_JSON\" 'j.projectStatus && j.projectStatus.conditions')\"",
        "      MEASURES_LIST=\"$(node_json_get \"$MEASURES_RAW\" 'j.component && j.component.measures')\"",
        "",
        "      MEASURE_MAP=\"$(printf '%s' \"$MEASURES_LIST\" | \"$NODE_BIN\" -e \"const fs=require('fs'); const measures=JSON.parse(fs.readFileSync(0,'utf8')||'[]'); const out={}; for(const m of measures){ const v=(m.value!==undefined)?m.value:(m.period&&m.period.value!==undefined)?m.period.value:null; out[m.metric]=v; } process.stdout.write(JSON.stringify(out));\")\"",
        "",
        "      export QUALITY_GATE_STATUS QUALITY_GATE_CONDITIONS QUALITY_GATE_JSON MEASURES_RAW CE_TASK_JSON SONAR_OUT_FILE SONAR_BRANCH",
        "",
        "      printf '%s' \"$MEASURE_MAP\" | \"$NODE_BIN\" -e \"",
        "        const fs=require('fs');",
        "        const m=JSON.parse(fs.readFileSync(0,'utf8')||'{}');",
        "        const num=(v)=>{ if(v===null||v===undefined||v==='') return null; const n=Number(v); return Number.isFinite(n)?n:null; };",
        "        const issueTotal=(v)=>{ const direct=num(v); if(direct!==null) return direct; if(typeof v!=='string') return null; const s=v.trim(); if(!s.startsWith('{')) return null; try{ const obj=JSON.parse(s); return num(obj&&obj.total);}catch{return null;} };",
        "        const payload={",
        "          mainproduct: process.env.MAINPRODUCT,",
        "          subproduct: process.env.SUBPRODUCT,",
        "          projectKey: process.env.SONAR_PROJECT_KEY,",
        "          hostUrl: process.env.SONAR_HOST_URL,",
        "          branch: process.env.SONAR_BRANCH,",
        "          summary:{",
        "            overall:{",
        "              bugs:num(m.bugs), vulnerabilities:num(m.vulnerabilities), codeSmells:num(m.code_smells), securityHotspots:num(m.security_hotspots),",
        "              coverage:num(m.coverage), duplicatedLinesDensity:num(m.duplicated_lines_density),",
        "              reliabilityIssues:issueTotal(m.reliability_issues), securityIssues:issueTotal(m.security_issues), maintainabilityIssues:issueTotal(m.maintainability_issues),",
        "              acceptedIssues:num(m.accepted_issues), violations:num(m.violations)",
        "            },",
        "            newCode:{",
        "              bugs:num(m.new_bugs), vulnerabilities:num(m.new_vulnerabilities), codeSmells:num(m.new_code_smells), securityHotspots:num(m.new_security_hotspots),",
        "              coverage:num(m.new_coverage), duplicatedLinesDensity:num(m.new_duplicated_lines_density),",
        "              reliabilityIssues:issueTotal(m.new_reliability_issues), securityIssues:issueTotal(m.new_security_issues), maintainabilityIssues:issueTotal(m.new_maintainability_issues),",
        "              acceptedIssues:num(m.new_accepted_issues), violations:num(m.new_violations)",
        "            },",
        "            qualityGate:{",
        "              status: process.env.QUALITY_GATE_STATUS || null,",
        "              conditions: (()=>{ try{return JSON.parse(process.env.QUALITY_GATE_CONDITIONS||'[]');}catch{return [];} })(),",
        "            }",
        "          },",
        "          raw:{",
        "            qualityGate:(()=>{ try{return JSON.parse(process.env.QUALITY_GATE_JSON||'{}');}catch{return {};} })(),",
        "            measures:(()=>{ try{return JSON.parse(process.env.MEASURES_RAW||'{}');}catch{return {};} })(),",
        "            ceTask:(()=>{ try{return JSON.parse(process.env.CE_TASK_JSON||'{}');}catch{return {};} })(),",
        "          }",
        "        };",
        "        fs.writeFileSync(process.env.SONAR_OUT_FILE||'sonar-summary.json', JSON.stringify(payload,null,2));",
        "      \"",
        "",
        "      echo \"Wrote $SONAR_OUT_FILE\" >&2",
        "",
        "      if [ -n \"$DASHBOARD_API_URL\" ]; then",
        "        echo \"Posting to dashboard: $DASHBOARD_API_URL$DASHBOARD_SONAR_PATH\" >&2",
        "        curl -sS -X POST -H \"Content-Type: application/json\" \"$DASHBOARD_API_URL$DASHBOARD_SONAR_PATH\" --data-binary @\"$SONAR_OUT_FILE\" >/dev/null",
        "      fi",
        "  artifacts:",
        "    when: always",
        "    paths:",
        "      - sonar-summary.json",
        "    expire_in: 7 days",
        "  allow_failure: true",
      ].join("\n"),
    );

    const content = templateLines.join("\n") + "\n";

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"gitlab-sonarqube-job-template.txt\"");
    res.end(content);
    return { props: {} };
  }

  if (date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Invalid date format. Use yyyy-mm-dd\n");
      return { props: {} };
    }
  }

  const client = await clientPromise;
  const db = client.db("automedtest-dashboard");

  const filter: any = {};
  if (date) filter.date = date;
  if (mainproduct) filter.mainproduct = mainproduct;

  const rawDoc = await db
    .collection(subproduct)
    .find(filter)
    .sort({ date: -1, "sonar.fetchedAtTime": -1 })
    .limit(1)
    .next();

  if (!rawDoc) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("No SonarQube data found for this query.\n");
    return { props: {} };
  }

  const sonar = (rawDoc as any).sonar ?? {};
  const summary = sonar?.summary ?? {};
  const overall = summary?.overall ?? {};
  const newCode = summary?.newCode ?? {};

  const measuresRaw =
    sonar?.raw?.measures?.component?.measures ?? sonar?.raw?.measures?.measures ?? sonar?.raw?.measures ?? undefined;
  const measureMap = buildMeasureMap(measuresRaw);

  const qualityGate =
    sonar?.raw?.qualityGate?.projectStatus ?? sonar?.raw?.qualityGate ?? summary?.qualityGate ?? ({} as any);

  const scannedAtDate = sonar?.fetchedAtDate || (rawDoc as any).date || "";
  const scannedAtTime = sonar?.fetchedAtTime || (rawDoc as any).time || "";

  const projectKey = String(sonar?.projectKey || "");
  const branch = sonar?.branch ? String(sonar.branch) : "";

  const reliabilityIssues = pickFirstNumberOrNull(
    overall?.reliabilityIssues,
    issueTotalOrNull(measureMap.reliability_issues?.value),
  );
  const securityIssues = pickFirstNumberOrNull(overall?.securityIssues, issueTotalOrNull(measureMap.security_issues?.value));
  const maintainabilityIssues = pickFirstNumberOrNull(
    overall?.maintainabilityIssues,
    issueTotalOrNull(measureMap.maintainability_issues?.value),
  );

  const acceptedIssues = pickFirstNumberOrNull(overall?.acceptedIssues, toNumberOrNull(measureMap.accepted_issues?.value));
  const securityHotspots = pickFirstNumberOrNull(
    overall?.securityHotspots,
    toNumberOrNull(measureMap.security_hotspots?.value),
  );

  const coverage = pickFirstNumberOrNull(overall?.coverage, toNumberOrNull(measureMap.coverage?.value));
  const duplication = pickFirstNumberOrNull(
    overall?.duplicatedLinesDensity,
    toNumberOrNull(measureMap.duplicated_lines_density?.value),
  );

  // Sonar UI "New issues" card: use new_violations when new_issues is not present.
  const newIssues = pickFirstNumberOrNull(
    newCode?.violations,
    newCode?.issues,
    toNumberOrNull(measureMap.new_issues?.value),
    toNumberOrNull(measureMap.new_violations?.value),
  );

  const newAccepted = pickFirstNumberOrNull(
    newCode?.acceptedIssues,
    toNumberOrNull(measureMap.new_accepted_issues?.value),
  );

  const newReliability = pickFirstNumberOrNull(
    newCode?.reliabilityIssues,
    issueTotalOrNull(measureMap.new_reliability_issues?.value),
  );
  const newSecurity = pickFirstNumberOrNull(newCode?.securityIssues, issueTotalOrNull(measureMap.new_security_issues?.value));
  const newMaintainability = pickFirstNumberOrNull(
    newCode?.maintainabilityIssues,
    issueTotalOrNull(measureMap.new_maintainability_issues?.value),
  );

  const qgStatus = String(qualityGate?.status || "");
  const qgConditions: any[] = Array.isArray(qualityGate?.conditions) ? qualityGate.conditions : [];

  const lines: string[] = [];
  lines.push("SonarQube Summary");
  lines.push("================");
  lines.push("");
  lines.push(`Main Product: ${String((rawDoc as any).mainproduct || mainproduct || "-")}`);
  lines.push(`Sub Product : ${subproduct}`);
  lines.push(`Project Key : ${projectKey || "-"}`);
  lines.push(`Branch      : ${branch || "-"}`);
  lines.push(`Scanned At  : ${scannedAtDate || "-"}${scannedAtTime ? " " + scannedAtTime : ""} (+07:00)`);
  lines.push("");

  lines.push("Quality Gate");
  lines.push("-----------");
  lines.push(`Status: ${qgStatus || "-"}`);
  if (qgConditions.length) {
    lines.push("Conditions:");
    for (const c of qgConditions) {
      const status = String(c?.status || "");
      const metricKey = String(c?.metricKey || "");
      const comparator = String(c?.comparator || "");
      const errorThreshold = c?.errorThreshold != null ? String(c.errorThreshold) : "";
      const actualValue = c?.actualValue != null ? String(c.actualValue) : "";
      lines.push(
        `- ${status} | ${metricKey} ${comparator} ${errorThreshold}${actualValue ? ` (actual: ${actualValue})` : ""}`,
      );
    }
  }
  lines.push("");

  lines.push("Overall Code");
  lines.push("------------");
  lines.push(`Reliability issues     : ${reliabilityIssues ?? "-"}`);
  lines.push(`Security issues        : ${securityIssues ?? "-"}`);
  lines.push(`Maintainability issues : ${maintainabilityIssues ?? "-"}`);
  lines.push(`Accepted issues        : ${acceptedIssues ?? "-"}`);
  lines.push(`Security Hotspots      : ${securityHotspots ?? "-"}`);
  lines.push(`Coverage               : ${asPercent(coverage)}`);
  lines.push(`Duplications           : ${asPercent(duplication)}`);
  lines.push("");

  lines.push("New Code");
  lines.push("--------");
  lines.push(`New issues             : ${newIssues ?? "-"}`);
  lines.push(`New accepted issues    : ${newAccepted ?? "-"}`);
  lines.push(`New reliability issues : ${newReliability ?? "-"}`);
  lines.push(`New security issues    : ${newSecurity ?? "-"}`);
  lines.push(`New maintainability    : ${newMaintainability ?? "-"}`);

  const content = lines.join("\n") + "\n";

  const filenameDate = formatDateForFilename(String((rawDoc as any).date || date || scannedAtDate || "")) || "latest";
  const filename = `sonar-summary_${safeFilenamePart(subproduct)}_${filenameDate}.txt`;

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.end(content);

  return { props: {} };
};

export default function SonarDownloadPage() {
  // This page streams a .txt download via getServerSideProps.
  return null;
}
