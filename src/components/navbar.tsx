import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import LoadingState from "./LoadingState";

function navbar() {
  const [isOpen, setIsOpen] = useState(true);
  // Change selectedProduct to store both main and sub product for uniqueness
  const [selectedProduct, setSelectedProduct] = useState<{
    main?: string;
    sub?: string;
  }>({});
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [originalNewProducts, setOriginalNewProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [openIndexes, setOpenIndexes] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [productFailStatus, setProductFailStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const [productErrorStatus, setProductErrorStatus] = useState<{
    [key: string]: boolean;
  }>({});
  const router = useRouter();

  // Keep dropdown state persistent
  const keepDropdownOpen = (
    currentSelectedProduct: string,
    newProducts: any[]
  ) => {
    if (currentSelectedProduct) {
      // Find which main product contains this sub-product
      const parentProduct = newProducts.find((product) =>
        product.subProduct?.includes(currentSelectedProduct)
      );
      if (parentProduct) {
        setOpenIndexes((prev) => ({
          ...prev,
          [parentProduct.mainProduct]: true,
        }));
      }
    }
  };

  const handleToggleSub = (productName: string) => {
    setOpenIndexes((prev) => ({
      ...prev,
      [productName]: !prev[productName],
    }));
  };

  const onSelectProduct = (main: string, sub?: string) => {
    setSelectedProduct(sub ? { main, sub } : { main });
    if (!main) {
      router.push("/");
    } else if (sub) {
      router.push(`/${main}/${sub}`, undefined, { shallow: true });
    } else {
      router.push(`/${main}`, undefined, { shallow: true });
    }
  };

  useEffect(() => {
    const fetchNewProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/getnewproductname");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        console.log("Fetching new products from API", data);
        setNewProducts(data.products);
        setOriginalNewProducts(data.products);

        // Fetch fail status for all products
        await fetchProductFailStatus(data.products);

        // Keep dropdown open if we're on a sub-product page
        if (router.query.slug) {
          keepDropdownOpen(router.query.slug.toString(), data.products);
        }
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNewProducts();
  }, []);

  const fetchProductFailStatus = async (products: any[]) => {
    const failStatus: { [key: string]: boolean } = {};
    const errorStatus: { [key: string]: boolean } = {};
    try {
      const response = await fetch(`/api/getnavbardata`);
      if (response.ok) {
        const data = await response.json();
        console.log("flookkyz getnavbar", data);

        // แยกข้อมูลจาก response
        if (data.data) {
          Object.keys(data.data).forEach((collectionName) => {
            const collectionData = data.data[collectionName];
            failStatus[collectionName] = collectionData.hasFail || false;
            errorStatus[collectionName] = collectionData.hasError || false;
          });
        }
        
        console.log("flookkyz failStatus:", failStatus);
        console.log("flookkyz errorStatus:", errorStatus);
        
        // Set states
        setProductFailStatus(failStatus);
        setProductErrorStatus(errorStatus);
      }
    } catch (error) {
      console.log("Error fetching product fail status:", error);
    }
  };

  // Set selected product based on current route
  useEffect(() => {
    if (router.query.slug) {
      // slug อาจเป็น array หรือ string
      const slugArr = Array.isArray(router.query.slug)
        ? router.query.slug
        : [router.query.slug];
      if (slugArr.length === 2) {
        setSelectedProduct({ main: slugArr[0], sub: slugArr[1] });
      } else if (slugArr.length === 1) {
        setSelectedProduct({ main: slugArr[0] });
      }
      if (newProducts.length > 0) {
        keepDropdownOpen(slugArr[slugArr.length - 1], newProducts);
      }
    } else {
      setSelectedProduct({});
    }
    // Don't reset openIndexes when route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.slug, newProducts]);

  return (
    <>
      <div className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-auto font-nunito">
        <div className="p-4">
          <h1
            className="text-4xl font-bold cursor-pointer rounded font-nunito text-center"
            onClick={() => onSelectProduct("")}
          >
            Dashboard
          </h1>
        </div>
        <div className={`overflow-y-auto ${isOpen ? "block" : "hidden"}`}>
          {loading ? (
            <LoadingState variant="simple" label="Loading products..." />
          ) : error ? (
            <div className="p-4 text-red-400">Error loading products: {error}</div>
          ) : null}
          <div className="flex items-center justify-center mt-2">
            <input
              type="text"
              placeholder="Filter products..."
              className="w-[90%] p-2 mb-2 ring-0 border-0 rounded rounded-md p-2 bg-gray-700 text-white focus:outline-none focus:ring-0 focus:ring-blue-400 focus:border-transparent font-nunito"
              disabled={loading}
              onChange={(e) => {
                const filter = e.target.value.toLowerCase();
                setNewProducts(
                  originalNewProducts
                    .map((product) => {
                      // Filter subProducts that match the filter
                      const filteredSubProducts =
                        product.subProduct?.filter((sub: string) =>
                          sub.toLowerCase().includes(filter)
                        ) || [];

                      // Check if mainProduct matches or any subProduct matches
                      if (product.mainProduct.toLowerCase().includes(filter)) {
                        // If mainProduct matches, keep all subProducts
                        return { ...product };
                      } else if (filteredSubProducts.length > 0) {
                        // If only subProducts match, keep only those subProducts
                        return { ...product, subProduct: filteredSubProducts };
                      }
                      // Otherwise, filter out this product
                      return null;
                    })
                    .filter(Boolean)
                );
              }}
            />
          </div>
          <ul>
            {loading ? null : newProducts.length === 0 ? (
              <li className="block pt-4 p-2 border-b border-gray-400 border-b-2">
                No products available
              </li>
            ) : (
              newProducts.map((product, index) => {
                const isOpenSub = openIndexes[product.mainProduct] || false;
                const mainProductHasFail =
                  productFailStatus[product.mainProduct] || false;
                const mainProductHasError =
                  productErrorStatus[product.mainProduct] || false;

                // Check if any sub-products have fails or errors
                const hasSubProductFail =
                  product.subProduct?.some(
                    (sub: string) => productFailStatus[sub] || false
                  ) || false;
                const hasSubProductError =
                  product.subProduct?.some(
                    (sub: string) => productErrorStatus[sub] || false
                  ) || false;

                // Main product should be red if it has fails OR any sub-product has fails
                // Main product should be yellow if it has error OR any sub-product has error
                const shouldShowRed = mainProductHasFail || hasSubProductFail;
                const shouldShowYellow =
                  mainProductHasError || hasSubProductError;

                return (
                  <React.Fragment key={index}>
                    <li>
                      <div
                        className={`flex items-center justify-between block pt-4 p-2 border-b-2 border-gray-600 cursor-pointer ${
                          selectedProduct.main === product.mainProduct &&
                          !selectedProduct.sub
                            ? "bg-gray-600 text-blue-300"
                            : shouldShowYellow
                            ? "hover:bg-yellow-500 bg-yellow-400 text-yellow-900"
                            : shouldShowRed
                            ? "hover:bg-red-500 bg-red-400 text-red-900"
                            : "hover:bg-gray-700"
                        }`}
                        onClick={() => handleToggleSub(product.mainProduct)}
                      >
                        <span
                          className={
                            selectedProduct.main === product.mainProduct &&
                            !selectedProduct.sub
                              ? "text-blue-300 font-bold"
                              : shouldShowRed
                              ? "text-red-900"
                              : shouldShowYellow
                              ? "text-yellow-900"
                              : ""
                          }
                        >
                          {shouldShowYellow && "⚠️ "}
                          {shouldShowRed && "🛑 "}
                          {product.mainProduct}
                        </span>
                        {product.subProduct &&
                          product.subProduct.length > 0 && (
                            <svg
                              className={`w-4 h-4 ml-2 transform transition-transform duration-200 ${
                                isOpenSub ? "rotate-90" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          )}
                      </div>
                    </li>
                    {product.subProduct &&
                      isOpenSub &&
                      product.subProduct.map(
                        (subProduct: any, subIndex: any) => {
                          const subProductHasFail =
                            productFailStatus[subProduct] || false;
                          const subProductHasError =
                            productErrorStatus[subProduct] || false;

                          return (
                            <li key={`${index}-${subIndex}`}>
                              <a
                                className={`block pl-8 pt-2 p-2 border-b border-gray-600 cursor-pointer ${
                                  selectedProduct.main ===
                                    product.mainProduct &&
                                  selectedProduct.sub === subProduct
                                    ? "bg-gray-600 text-blue-300 font-bold"
                                    : subProductHasError
                                    ? "hover:bg-yellow-500 bg-yellow-400 text-yellow-900"
                                    : subProductHasFail
                                    ? "hover:bg-red-500 bg-red-400 text-red-900"
                                    : "hover:bg-gray-700"
                                }`}
                                onClick={() =>
                                  onSelectProduct(
                                    product.mainProduct,
                                    subProduct
                                  )
                                }
                              >
                                {subProductHasError && "⚠️ "}
                                {subProductHasFail && "🛑 "}
                                <span
                                  className={
                                    selectedProduct.main ===
                                      product.mainProduct &&
                                    selectedProduct.sub === subProduct
                                      ? "text-blue-300 font-bold"
                                      : subProductHasFail
                                      ? "text-red-900"
                                      : subProductHasError
                                      ? "text-yellow-900"
                                      : ""
                                  }
                                >
                                  {subProduct}
                                </span>
                              </a>
                            </li>
                          );
                        }
                      )}
                  </React.Fragment>
                );
              })
            )}
          </ul>
        </div>
      </div>
    </>
  );
}

export default navbar;
