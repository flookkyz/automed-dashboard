import { useCallback, useEffect, useMemo, useState } from "react";

export { findSimilar } from "./productNames";

// Shared client-side view of the product registry (`/api/getnewproductname`).

export type SubProduct = {
    name: string;
    flag?: "all" | "fail" | "error" | "pass";
    hasSonar?: boolean;
};

export type Product = {
    mainProduct: string;
    subProduct?: Array<string | SubProduct>;
};

/** Subproducts arrive either as plain names or as objects carrying status. */
export function subName(sub: string | SubProduct): string {
    return typeof sub === "string" ? sub : sub?.name;
}

export function subNames(product: Product | null | undefined): string[] {
    return (product?.subProduct ?? []).map(subName).filter(Boolean);
}

export const PRODUCTS_CHANGED_EVENT = "automed:products-changed";

export function notifyProductsChanged(): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(PRODUCTS_CHANGED_EVENT));
}

export type ProductsState = {
    products: Product[];
    loading: boolean;
    error: string | null;
    mainProductNames: string[];
    reload: () => Promise<void>;
};

export function useProducts(): ProductsState {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // [old] const resp = await fetch(`/api/getnewproductname`);
            const resp = await fetch(`/api/getnewproductname`, { cache: "no-store" });
            if (!resp.ok) throw new Error(`Network response was not ok: ${resp.status}`);
            const data = await resp.json();
            setProducts((data.products || []) as Product[]);
        } catch (err: any) {
            setError(err?.message ?? String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const mainProductNames = useMemo(
        () => products.map((p) => p.mainProduct).filter(Boolean),
        [products],
    );

    return { products, loading, error, mainProductNames, reload };
}
