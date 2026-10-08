// Mock data for running the dashboard without MongoDB.
//
// Test runs are generated deterministically from (mainProduct, subProduct,
// date), so the same day always shows the same numbers across reloads and
// across endpoints (summary, history, detail page all agree).

export type MockTestCase = {
    name: string;
    pass: number;
    fail: number;
    error: number;
    time: string;
    detailfail: Array<Record<string, string>>;
    detailerror: Array<Record<string, string>>;
};

export type MockSonar = {
    projectKey: string;
    hostUrl: string;
    fetchedAtDate: string;
    fetchedAtTime: string;
    summary: { qualityGate: string };
};

export type MockTestDoc = {
    date: string;
    time: string;
    mainproduct: string;
    subproduct: string;
    nametest: MockTestCase[];
    sonar?: MockSonar;
};

export type MockProduct = { mainProduct: string; subProduct: string[] };

/** How many days back test runs are generated for. */
const HISTORY_DAYS = 60;

/** Subproducts that report SonarQube scans. Key: "<main>::<sub>". */
const SONAR_PAIRS = new Set([
    "AutoMed::order",
    "AutoMed::inventory",
    "PharmaCare::dispense",
    "LabLink::result",
]);

/** Registered but never reported, to exercise the empty states. */
const NO_DATA_PAIRS = new Set(["NewProject::onboarding", "PharmaCare::report"]);

const SUITES: Record<string, string[]> = {
    order: ["Place Order Tests", "Cancel Order Tests", "Order History Tests", "Payment Tests"],
    inventory: ["Stock Count Tests", "Restock Tests", "Expiry Alert Tests"],
    prescription: ["Create Prescription Tests", "Doctor Approval Tests", "Refill Tests"],
    billing: ["Invoice Tests", "Insurance Claim Tests", "Refund Tests"],
    dispense: ["Dispense Flow Tests", "Barcode Scan Tests", "Label Print Tests"],
    report: ["Daily Report Tests", "Export CSV Tests"],
    sample: ["Sample Register Tests", "Sample Tracking Tests"],
    result: ["Result Entry Tests", "Result Approval Tests", "Critical Value Tests"],
    onboarding: ["Signup Tests"],
};

const DEFAULT_PRODUCTS: MockProduct[] = [
    { mainProduct: "AutoMed", subProduct: ["order", "inventory", "prescription", "billing"] },
    { mainProduct: "PharmaCare", subProduct: ["order", "dispense", "report"] },
    { mainProduct: "LabLink", subProduct: ["sample", "result"] },
    { mainProduct: "NewProject", subProduct: ["onboarding"] },
];

// Mutable registry so add/delete product calls are reflected until reload.
let registry: MockProduct[] = DEFAULT_PRODUCTS.map((p) => ({ ...p, subProduct: [...p.subProduct] }));

export function getRegistry(): MockProduct[] {
    return registry;
}

export function setRegistry(next: MockProduct[]): void {
    registry = next;
}

// --- deterministic randomness ---

function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Small seeded PRNG (mulberry32). */
function rng(seed: string): () => number {
    let a = hash(seed);
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateKey(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dates (oldest first) on which this pair has a test run. */
export function runDates(mainProduct: string, subProduct: string): string[] {
    if (NO_DATA_PAIRS.has(`${mainProduct}::${subProduct}`)) return [];

    const out: string[] = [];
    const today = new Date();
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const key = toDateKey(d);
        // Today always has a run; other days skip ~20% so the history has gaps.
        if (i === 0 || rng(`${mainProduct}|${subProduct}|${key}|run`)() > 0.2) out.push(key);
    }
    return out;
}

function makeCase(name: string, rand: () => number): MockTestCase {
    const total = 5 + Math.floor(rand() * 20);
    const roll = rand();
    const fail = roll > 0.85 ? 1 + Math.floor(rand() * 3) : 0;
    const error = roll > 0.96 ? 1 + Math.floor(rand() * 2) : 0;
    const pass = Math.max(0, total - fail - error);

    const detailfail = Array.from({ length: fail }, (_, i) => ({
        name: `${name} › case ${i + 1} should match expected value`,
        error: `expect(received).toBe(expected)\nCall log:\n  - waiting for locator('#result-${i + 1}')`,
        expected: `"OK"`,
        received: `"FAILED"`,
    }));
    const detailerror = Array.from({ length: error }, (_, i) => ({
        name: `${name} › case ${fail + i + 1} timed out`,
        error: `TimeoutError: page.click: Timeout 30000ms exceeded.\nCall log:\n  - waiting for selector "button#submit"`,
    }));

    return {
        name,
        pass,
        fail,
        error,
        time: `${(5 + rand() * 120).toFixed(2)}s`,
        detailfail,
        detailerror,
    };
}

/** The test document for one pair on one date, or null when it has no run. */
export function testDoc(mainProduct: string, subProduct: string, date: string): MockTestDoc | null {
    if (!runDates(mainProduct, subProduct).includes(date)) return null;

    const rand = rng(`${mainProduct}|${subProduct}|${date}`);
    const suites = SUITES[subProduct] ?? ["Smoke Tests", "Regression Tests"];
    const hour = 8 + Math.floor(rand() * 10);
    const doc: MockTestDoc = {
        date,
        time: `${pad(hour)}:${pad(Math.floor(rand() * 60))}:${pad(Math.floor(rand() * 60))}`,
        mainproduct: mainProduct,
        subproduct: subProduct,
        nametest: suites.map((s) => makeCase(s, rand)),
    };

    const pair = `${mainProduct}::${subProduct}`;
    // Sonar scans run roughly every few days.
    if (SONAR_PAIRS.has(pair) && rng(`${pair}|${date}|sonar`)() > 0.6) {
        doc.sonar = {
            projectKey: `${mainProduct.toLowerCase()}-${subProduct}`,
            hostUrl: "https://sonarqube.example.local",
            fetchedAtDate: date,
            fetchedAtTime: `${pad(hour)}:30:00`,
            summary: { qualityGate: rand() > 0.3 ? "OK" : "ERROR" },
        };
    }
    return doc;
}

/** Newest document for the pair (optionally only ones with a Sonar scan). */
export function latestDoc(
    mainProduct: string,
    subProduct: string,
    opts: { withSonar?: boolean } = {},
): MockTestDoc | null {
    const dates = runDates(mainProduct, subProduct);
    for (let i = dates.length - 1; i >= 0; i--) {
        const doc = testDoc(mainProduct, subProduct, dates[i]);
        if (doc && (!opts.withSonar || doc.sonar)) return doc;
    }
    return null;
}

/** SonarQube measures in the shape `/api/getsonarqdata` returns. */
export function sonarDetail(doc: MockTestDoc) {
    const rand = rng(`${doc.mainproduct}|${doc.subproduct}|${doc.date}|measures`);
    const passed = doc.sonar?.summary.qualityGate === "OK";
    const newCoverage = passed ? 80 + rand() * 15 : 50 + rand() * 25;
    const int = (max: number) => String(Math.floor(rand() * max));

    return {
        qualityGate: {
            status: passed ? "OK" : "ERROR",
            conditions: [
                {
                    metricKey: "new_coverage",
                    comparator: "LT",
                    errorThreshold: "80",
                    actualValue: newCoverage.toFixed(1),
                    status: newCoverage >= 80 ? "OK" : "ERROR",
                },
                {
                    metricKey: "new_duplicated_lines_density",
                    comparator: "GT",
                    errorThreshold: "3",
                    actualValue: "1.2",
                    status: "OK",
                },
            ],
        },
        measures: [
            { metric: "new_violations", period: { value: passed ? "0" : int(8) } },
            { metric: "new_accepted_issues", period: { value: int(3) } },
            { metric: "new_coverage", period: { value: newCoverage.toFixed(1) } },
            { metric: "new_duplicated_lines_density", period: { value: "1.2" } },
            { metric: "new_security_hotspots", period: { value: int(3) } },
            { metric: "violations", value: int(120) },
            { metric: "accepted_issues", value: int(10) },
            { metric: "coverage", value: (60 + rand() * 30).toFixed(1) },
            { metric: "duplicated_lines_density", value: (rand() * 6).toFixed(1) },
            { metric: "security_hotspots", value: int(15) },
            { metric: "bugs", value: int(20) },
            { metric: "vulnerabilities", value: int(5) },
            { metric: "code_smells", value: int(100) },
        ],
        newCodePeriod: { type: "PREVIOUS_VERSION", value: "1.4.0" },
    };
}
