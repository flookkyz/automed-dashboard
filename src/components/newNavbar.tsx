import React, { useCallback, useEffect, useMemo, useState } from "react";
import SearchInput from "../components/scarchInput";
import MenuItem from "../components/menuItem";
import { useRouter } from "next/router";
import LoadingState from "./LoadingState";

type Flag = "all" | "fail" | "error" | "pass" | undefined;

type SubProduct = string | { name: string; flag?: Flag };

type Product = {
  mainProduct: string;
  subProduct?: SubProduct[];
};

function NewNavbarpage() {
  const router = useRouter();
  const [scarchInputValue, setScarchInputValue] = useState("");
  const activeMain = typeof router.query.mainproduct === "string" ? router.query.mainproduct : undefined;
  const activeSub = typeof router.query.subproduct === "string" ? router.query.subproduct : undefined;

  const handleSelect = useCallback((main?: string, sub?: string) => {
    if (!main) {
      router.push("/");
    } else if (sub) {
      router.push(`/${main}/${sub}`, undefined, { shallow: true });
    } else {
      router.push(`/${main}`, undefined, { shallow: true });
    }
  }, [router]);

  const [originalProducts, setOriginalProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`/api/getnewproductname`);
        if (!response.ok)
          throw new Error(`Network response was not ok: ${response.status}`);
        const data = await response.json();

        const products = (data.products || []) as Product[];
        setOriginalProducts(products);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error("Error fetching products:", err);
        setErrorMsg(err?.message ?? String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const handleFilter = useCallback((value: string) => {
    setScarchInputValue(value);
  }, []);

  const visibleProducts = useMemo(() => {
    const filter = scarchInputValue.trim().toLowerCase();
    if (!filter) return originalProducts;

    return originalProducts
      .map((product) => {
        const subs = Array.isArray(product.subProduct) ? product.subProduct : [];

        const filteredSubProducts = subs.filter((sub) => {
          const name = typeof sub === "string" ? sub : sub?.name;
          return typeof name === "string" && name.toLowerCase().includes(filter);
        });

        if (product.mainProduct?.toLowerCase().includes(filter)) {
          return product;
        }

        if (filteredSubProducts.length > 0) {
          return { ...product, subProduct: filteredSubProducts };
        }

        return null;
      })
      .filter((p): p is Product => Boolean(p));
  }, [originalProducts, scarchInputValue]);

  const getMainFlag = useCallback((subProducts: SubProduct[] | undefined): Flag => {
    const childFlags: Array<Flag> = (subProducts || []).map((c) =>
      typeof c === "string" ? undefined : c.flag
    );

    if (childFlags.includes("all")) return "all";

    const hasFail = childFlags.includes("fail");
    const hasError = childFlags.includes("error");
    const hasPass = childFlags.includes("pass");

    if (hasFail && hasError) return "all";
    if (hasFail) return "fail";
    if (hasError) return "error";
    if (hasPass) return "pass";
    return undefined;
  }, []);

  return (
    <>
      <div
        className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-scroll font-nunito"
        style={{ scrollbarGutter: "stable" }}
      >
        <div
          className="text-center font-bold text-4xl py-4 cursor-pointer hover:scale-110 transition-transform duration-200"
          onClick={() => handleSelect()}
        >
          Dashboard
        </div>
        <div className="flex justify-center px-4">
          <SearchInput
            placeholder="Search..."
            value={scarchInputValue}
            onChange={handleFilter}
          />
        </div>
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => router.push("/history")}
            className={`w-full text-left rounded px-3 py-2 text-sm transition-colors ${
              router.pathname === "/history"
                ? "bg-gray-600 text-white"
                : "text-gray-200 hover:bg-gray-700"
            }`}
          >
            📅 History Schedule
          </button>
        </div>
        <div className="py-4 px-1">
          {/* Replace mock data with API-driven products from /api/getnewproductname */}
          {loading ? (
            <LoadingState variant="simple" label="Loading products..." />
          ) : errorMsg ? (
            <div className="p-4 text-red-400">
              Error loading products: {errorMsg}
            </div>
          ) : (
            visibleProducts.map((p) => {
              const mainFlag = getMainFlag(p.subProduct);
              return (
                <MenuItem
                  key={p.mainProduct}
                  mainproduct={p.mainProduct}
                  flag={mainFlag}
                  subproducts={p.subProduct}
                  onSelect={handleSelect}
                  activeMain={activeMain}
                  activeSub={activeSub}
                  active={
                    activeMain === p.mainProduct &&
                    typeof activeSub === "undefined"
                  }
                />
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default NewNavbarpage;
