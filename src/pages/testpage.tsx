import React, { useState } from "react";
import SearchInput from "../components/scarchInput";
import MenuItem from "../components/menuItem";
import LoadingState from "../components/LoadingState";

function testpage() {
  const [scarchInputValue, setScarchInputValue] = useState("");
  const [activeMain, setActiveMain] = useState<string | undefined>(undefined);
  const [activeSub, setActiveSub] = useState<string | undefined>(undefined);

  const handleSelect = (main?: string, sub?: string) => {
    setActiveMain(main);
    setActiveSub(sub);
    // log main and sub when clicked
    // (matches your request: console.log mainProduct and subProduct)
    // keep consistent formatting
    // eslint-disable-next-line no-console
    console.log("selected:", { mainProduct: main, subProduct: sub });
  };
  const [products, setProducts] = useState<any[]>([]);
  const [originalProducts, setOriginalProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch(`/api/getnewproductname`);
        if (!response.ok)
          throw new Error(`Network response was not ok: ${response.status}`);
        const data = await response.json();
        setProducts(data.products || []);
        setOriginalProducts(data.products || []);
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

  const handleFilter = (value: string) => {
    const filter = value.toLowerCase();
    setScarchInputValue(value);
    if (!filter) {
      setProducts(originalProducts);
      return;
    }

    const filtered = originalProducts
      .map((product) => {
        // subProduct items may be objects {name, flag} or strings
        const subs = Array.isArray(product.subProduct) ? product.subProduct : [];
        const filteredSubProducts = subs.filter((sub: any) => {
          const name = typeof sub === "string" ? sub : sub?.name;
          return typeof name === "string" && name.toLowerCase().includes(filter);
        });

        if (product.mainProduct?.toLowerCase().includes(filter)) {
          // keep full product when main matches
          return { ...product };
        } else if (filteredSubProducts.length > 0) {
          return { ...product, subProduct: filteredSubProducts };
        }
        return null;
      })
      .filter(Boolean);

    setProducts(filtered);
  };
  return (
    <>
      <div className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-auto font-nunito">
        <div className="text-center font-bold text-4xl py-4">Dashboard</div>
        <div className="flex justify-center px-4">
          <SearchInput
            placeholder="Search..."
            value={scarchInputValue}
            onChange={(value) => handleFilter(value)}
          />
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
            products.map((p) => {
              const childFlags: Array<string | undefined> = (
                p.subProduct || []
              ).map((c: any) => (typeof c === "string" ? undefined : c.flag));

              let mainFlag: any = undefined;
              if (childFlags.includes("all")) {
                mainFlag = "all";
              } else {
                const hasFail = childFlags.includes("fail");
                const hasError = childFlags.includes("error");
                if (hasFail && hasError) mainFlag = "all";
                else if (hasFail) mainFlag = "fail";
                else if (hasError) mainFlag = "error";
                else mainFlag = undefined;
              }

              return (
                <MenuItem
                  key={p.mainProduct}
                  mainproduct={p.mainProduct}
                  flag={mainFlag}
                  subproducts={p.subProduct as any}
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

export default testpage;
