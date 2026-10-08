import { validateExistingName, validateNewName } from "../lib/productNames";
import {
    getRegistry,
    latestDoc,
    runDates,
    setRegistry,
    sonarDetail,
    testDoc,
    type MockTestDoc,
} from "./data";

// One handler per `/api/*` route the client calls. Each returns the same JSON
// shape (and status codes) as the real route in `src/pages/api`.

export type MockResult = { status: number; body: unknown };

type Handler = (query: URLSearchParams, body: any) => MockResult;

const ok = (body: unknown): MockResult => ({ status: 200, body });
const fail = (status: number, error: string): MockResult => ({ status, body: { error } });

const ciCompare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: "accent", caseFirst: "false" });

/** Every registered (main, sub) pair. */
function pairs(): Array<[string, string]> {
    return getRegistry().flatMap((p) => p.subProduct.map((s) => [p.mainProduct, s] as [string, string]));
}

/** The fields the summary/latest endpoints project (no failure details). */
function summaryOf(doc: MockTestDoc) {
    return {
        ...doc,
        nametest: doc.nametest.map(({ name, pass, fail, error, time }) => ({ name, pass, fail, error, time })),
    };
}

function flagOf(doc: MockTestDoc | null): "pass" | "fail" | "error" | null {
    if (!doc || doc.nametest.length === 0) return null;
    if (doc.nametest.some((t) => t.error > 0)) return "error";
    if (doc.nametest.some((t) => t.fail > 0)) return "fail";
    return "pass";
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function dateRange(from: string, to: string): string[] | null {
    const start = Date.parse(`${from}T00:00:00Z`);
    const end = Date.parse(`${to}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return null;
    const days = Math.round((end - start) / 86_400_000) + 1;
    if (days > 92) return null;
    return Array.from({ length: days }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

const getnewproductname: Handler = () => {
    const products = [...getRegistry()]
        .sort((a, b) => ciCompare(a.mainProduct, b.mainProduct))
        .map((p) => ({
            mainProduct: p.mainProduct,
            subProduct: [...p.subProduct].sort(ciCompare).map((name) => {
                const sonarDoc = latestDoc(p.mainProduct, name, { withSonar: true });
                return {
                    name,
                    flag: flagOf(latestDoc(p.mainProduct, name)),
                    hasSonar: Boolean(sonarDoc),
                    sonarScannedAt: sonarDoc?.sonar
                        ? { date: sonarDoc.sonar.fetchedAtDate, time: sonarDoc.sonar.fetchedAtTime }
                        : null,
                };
            }),
        }));
    return ok({ products });
};

const getproductname: Handler = () => ok(getRegistry());

const getsummary: Handler = (q) => {
    const date = q.get("date");
    const from = q.get("from");
    const to = q.get("to");

    let dates: string[];
    if (from || to) {
        if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
            return fail(400, "from and to must both be yyyy-mm-dd");
        }
        const range = dateRange(from, to);
        if (!range) return fail(400, "Invalid range (max 92 days, from must be <= to)");
        dates = range;
    } else {
        if (!date || !DATE_PATTERN.test(date)) {
            return fail(400, "date query parameter is required (yyyy-mm-dd)");
        }
        dates = [date];
    }

    const byDate: Record<string, Record<string, unknown>> = {};
    for (const d of dates) {
        byDate[d] = {};
        for (const [main, sub] of pairs()) {
            const doc = testDoc(main, sub, d);
            if (doc) byDate[d][`${main}::${sub}`] = summaryOf(doc);
        }
    }
    return ok(from ? byDate : byDate[dates[0]]);
};

const getlasttestdata: Handler = () => {
    const data: Record<string, unknown> = {};
    for (const [main, sub] of pairs()) {
        const doc = latestDoc(main, sub);
        if (doc) {
            const { sonar: _sonar, ...rest } = summaryOf(doc);
            data[`${main}::${sub}`] = rest;
        }
    }
    const collections = new Set(pairs().map(([, sub]) => sub));
    return ok({ data, collectionsProcessed: collections.size });
};

const getdatefromtest: Handler = (q) => {
    const main = q.get("mainproduct");
    const sub = q.get("subproduct");
    if (!sub) return fail(400, "Missing subproduct parameter");
    if (!main) return fail(400, "Missing mainproduct parameter");
    return ok(runDates(main, sub));
};

const gettestdata: Handler = (q) => {
    const main = q.get("mainproduct");
    const sub = q.get("subproduct");
    const date = q.get("date");
    if (!date) return fail(400, "Missing date parameter");
    if (!DATE_PATTERN.test(date)) return fail(400, "Invalid date format. Use yyyy-mm-dd");
    if (!main || !sub) return fail(400, "Missing subproduct parameter");
    const doc = testDoc(main, sub, date);
    return doc ? ok(doc) : fail(404, "Data not found");
};

const getmainproductdata: Handler = (q) => {
    const mainProduct = q.get("mainProduct") ?? q.get("mainproduct");
    if (!mainProduct) return fail(400, "Missing mainProduct parameter");
    const product = getRegistry().find((p) => p.mainProduct === mainProduct);
    if (!product) return fail(404, `Main product not found: ${mainProduct}`);

    const subproducts = product.subProduct.map((subproduct) => {
        const doc = latestDoc(mainProduct, subproduct);
        if (!doc) return { subproduct, latest: null };
        const { sonar: _sonar, subproduct: _sub, ...latest } = summaryOf(doc);
        return { subproduct, latest };
    });
    return ok({ mainProduct, subproducts, errors: [] });
};

const getsonarqdata: Handler = (q) => {
    const main = q.get("mainproduct") ?? "";
    const sub = q.get("subproduct");
    const date = q.get("date");
    if (!sub) return fail(400, "Missing subproduct parameter");
    if (date && !DATE_PATTERN.test(date)) return fail(400, "Invalid date format. Use yyyy-mm-dd");

    const mains = main ? [main] : getRegistry().filter((p) => p.subProduct.includes(sub)).map((p) => p.mainProduct);
    const docs = mains
        .map((m) => (date ? testDoc(m, sub, date) : latestDoc(m, sub, { withSonar: true })))
        .filter((d): d is MockTestDoc => Boolean(d))
        .sort((a, b) => b.date.localeCompare(a.date));
    const doc = docs[0];
    if (!doc) return fail(404, "Data not found");

    const sonar = doc.sonar;
    return ok({
        mainproduct: doc.mainproduct,
        subproduct: sub,
        projectKey: sonar?.projectKey,
        branch: "main",
        scannedAt: sonar ? `${sonar.fetchedAtDate}T${sonar.fetchedAtTime}+07:00` : undefined,
        analysisId: sonar ? `AY-mock-${doc.date}` : null,
        ...(sonar ? sonarDetail(doc) : {}),
        date: doc.date,
        time: doc.time,
    });
};

const addproductname: Handler = (_q, body) => {
    if (!body || typeof body !== "object") return fail(400, "Invalid JSON body");
    const main = validateNewName(body.mainProduct ?? body.mainproduct, "mainProduct");
    if (main.error) return fail(400, main.error);
    const mainProduct = main.value as string;

    const rawSubs = body.subProduct ?? body.subproduct ?? [];
    const requested: string[] = [];
    for (const raw of Array.isArray(rawSubs) ? rawSubs : [rawSubs]) {
        if (typeof raw === "string" && raw.trim() === "") continue;
        const sub = validateNewName(raw, "subProduct");
        if (sub.error) return fail(400, sub.error);
        if (!requested.includes(sub.value as string)) requested.push(sub.value as string);
    }

    const registry = getRegistry();
    const existing = registry.find((p) => p.mainProduct === mainProduct);
    const existingSubs = [...(existing?.subProduct ?? [])];
    const added = requested.filter((s) => !existingSubs.includes(s));
    const skipped = requested
        .filter((s) => existingSubs.includes(s))
        .map((name) => ({ name, reason: "already exists" }));

    if (existing) existing.subProduct.push(...added);
    else setRegistry([...registry, { mainProduct, subProduct: added }]);

    return ok({
        mainProduct,
        created: !existing,
        subProduct: [...existingSubs, ...added],
        added,
        skipped,
        warnings: [],
    });
};

const deleteproductname: Handler = (_q, body) => {
    if (!body || typeof body !== "object") return fail(400, "Invalid JSON body");
    const main = validateExistingName(body.mainProduct ?? body.mainproduct, "mainProduct");
    if (main.error) return fail(400, main.error);
    const mainProduct = main.value as string;

    const rawSub = body.subProduct ?? body.subproduct;
    const requested: string[] = [];
    for (const raw of Array.isArray(rawSub) ? rawSub : [rawSub]) {
        if (raw === undefined || raw === null) continue;
        if (typeof raw === "string" && raw.trim() === "") continue;
        const sub = validateExistingName(raw, "subProduct");
        if (sub.error) return fail(400, sub.error);
        if (!requested.includes(sub.value as string)) requested.push(sub.value as string);
    }

    const registry = getRegistry();
    const product = registry.find((p) => p.mainProduct === mainProduct);
    if (!product) return fail(404, `Main product not found: ${mainProduct}`);
    const missing = requested.find((s) => !product.subProduct.includes(s));
    if (missing) return fail(404, `Subproduct not found under ${mainProduct}: ${missing}`);

    const removingMainProduct = requested.length === 0;
    const targets = removingMainProduct ? [...product.subProduct] : requested;
    if (removingMainProduct) setRegistry(registry.filter((p) => p !== product));
    else product.subProduct = product.subProduct.filter((s) => !targets.includes(s));

    return ok({
        mainProduct,
        subProduct: requested.length === 1 ? requested[0] : null,
        removedSubProducts: targets,
        removedMainProduct: removingMainProduct,
        deletedTestData: body.deleteTestData === true,
        deletedDocuments: 0,
        droppedCollections: [],
        keptCollections: [],
    });
};

export const handlers: Record<string, Handler> = {
    getnewproductname,
    getproductname,
    getsummary,
    getlasttestdata,
    getdatefromtest,
    gettestdata,
    getmainproductdata,
    getsonarqdata,
    addproductname,
    deleteproductname,
};
