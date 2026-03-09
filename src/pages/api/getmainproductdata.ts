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

		const subproducts = await Promise.all(
			subproductNames.map(async (subproduct) => {
				try {
					const latest = await db.collection(subproduct).findOne(
						{ mainproduct: mainProduct },
						{
							sort: { date: -1 },
							projection: { _id: 0 },
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
			})
		);

		return res.status(200).json({
			mainProduct,
			subproducts,
			errors,
		});
	} catch (e: any) {
		return res.status(500).json({
			error: "Internal Server Error",
			details: e?.message ? String(e.message) : undefined,
		});
	}
}

