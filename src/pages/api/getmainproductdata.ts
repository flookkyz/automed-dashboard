import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type SubproductLatest = {
	subproduct: string;
	latest: Record<string, any> | null;
};

type ErrorItem = {
	subproduct?: string;
	error: string;
};

type ResponseData = {
	mainProduct: string;
	subproducts: SubproductLatest[];
	errors: ErrorItem[];
};

const CACHE_TTL_MS = 15_000;
// [old] const cache = new Map<string, { expiresAt: number; data: ResponseData }>();
const cache: Map<string, { expiresAt: number; data: ResponseData }> =
	(globalThis as any).__automed_getmainproductdata_cache ??
	((globalThis as any).__automed_getmainproductdata_cache = new Map());

async function asyncPool<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
		while (true) {
			const current = nextIndex++;
			if (current >= items.length) break;
			results[current] = await worker(items[current]);
		}
	});

	await Promise.all(runners);
	return results;
}

function getSingleQueryValue(value: string | string[] | undefined): string | undefined {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value[0];
	return undefined;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ResponseData | { error: string; details?: any }>
) {
	if (req.method !== "GET") {
		res.setHeader("Allow", ["GET"]);
		return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
	}

	const mainProduct =
		getSingleQueryValue(req.query.mainProduct as any) ??
		getSingleQueryValue(req.query.mainproduct as any);

	if (!mainProduct) {
		return res.status(400).json({ error: "Missing mainProduct parameter" });
	}

	const cached = cache.get(mainProduct);
	if (cached && cached.expiresAt > Date.now()) {
		return res.status(200).json(cached.data);
	}

	try {
		const client = await clientPromise;
		const db = client.db("automedtest-dashboard");

		const productDoc = await db
			.collection("product_name")
			.findOne({ mainProduct }, { projection: { _id: 0 } });

		if (!productDoc) {
			return res.status(404).json({ error: `Main product not found: ${mainProduct}` });
		}

		const rawSubs = Array.isArray((productDoc as any).subProduct)
			? (productDoc as any).subProduct
			: [];

		const subproductNames: string[] = rawSubs
			.map((s: any) => (typeof s === "string" ? s : s?.name))
			.filter((s: any): s is string => typeof s === "string" && s.length > 0);

		const errors: ErrorItem[] = [];

		const subproducts = await asyncPool(subproductNames, 10, async (subproduct) => {
			try {
				const latest = await db.collection(subproduct).findOne(
					{ mainproduct: mainProduct },
					{
						sort: { date: -1 },
						projection: {
							_id: 0,
							date: 1,
							time: 1,
							mainproduct: 1,
							"nametest.name": 1,
							"nametest.pass": 1,
							"nametest.fail": 1,
							"nametest.error": 1,
							"nametest.time": 1,
						},
					}
				);

				return { subproduct, latest } satisfies SubproductLatest;
			} catch (e: any) {
				errors.push({
					subproduct,
					error: e?.message ? String(e.message) : "Failed to query subproduct collection",
				});
				return { subproduct, latest: null } satisfies SubproductLatest;
			}
		});

		const payload: ResponseData = {
			mainProduct,
			subproducts,
			errors,
		};

		cache.set(mainProduct, { expiresAt: Date.now() + CACHE_TTL_MS, data: payload });
		return res.status(200).json(payload);
	} catch (e: any) {
		return res.status(500).json({
			error: "Internal Server Error",
			details: e?.message ? String(e.message) : undefined,
		});
	}
}

