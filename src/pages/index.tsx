"use client";
import React, { useState, useEffect } from "react";
import SummaryDashboard from "../components/SummaryDashboard";
import Dashboard from "../components/Dashboard";

export default function Home() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [newProducts, setNewProducts] = useState<any[]>([]);
  const [originalNewProducts, setOriginalNewProducts] = useState<any[]>([]);
  const [openIndexes, setOpenIndexes] = useState<{ [key: number]: boolean }>(
    {}
  );
  // Removed isOpenSub from here; it will be defined inside the map callback below.

  const handleToggleSub = (idx: number) => {
    setOpenIndexes((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const onSelectProduct = (product: any) => {
    setSelectedProduct(product);
  };

  useEffect(() => {
    const fetchNewProducts = async () => {
      try {
        const response = await fetch("/api/getnewproductname");
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        console.log("Fetching new products from API", data);
        setNewProducts(data.products);
        setOriginalNewProducts(data.products);
      } catch (error: any) {
        setError(error.message);
      }
    };

    fetchNewProducts();
  }, []);

  console.log("newProducts", newProducts);

  return (
    <>
      <div className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-auto">
        <div className="p-4">
          <h1
            className="text-2xl font-bold cursor-pointer"
            onClick={() => onSelectProduct("")}
          >
            Dashboard
          </h1>
        </div>
        <div className={`overflow-y-auto ${isOpen ? "block" : "hidden"}`}>
          <div className="flex items-center justify-center mt-2">
            <input
              type="text"
              placeholder="Filter products"
              className="w-[90%] p-2 mb-2 ring-0 border-0 rounded rounded-md p-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-0 focus:ring-blue-400 focus:border-transparent"
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
            {newProducts.length === 0 ? (
              <li className="block pt-4 p-2 border-b border-gray-600 dark:border-gray-400 border-b-2">
                No products available
              </li>
            ) : (
              newProducts.map((product, index) => {
                const isOpenSub = openIndexes[index] || false;
                return (
                  <React.Fragment key={index}>
                    <li>
                      <div
                        className="flex items-center justify-between block pt-4 p-2 border-b-2 border-gray-600 dark:border-gray-600 hover:bg-gray-700 cursor-pointer"
                        onClick={() => handleToggleSub(index)}
                      >
                        <span>{product.mainProduct}</span>
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
                        (subProduct: any, subIndex: any) => (
                          <li key={`${index}-${subIndex}`}>
                            <a
                              className="block pl-8 pt-2 p-2 border-b border-gray-600 dark:border-gray-600 hover:bg-gray-700 cursor-pointer"
                              onClick={() => onSelectProduct(subProduct)}
                            >
                              {subProduct}
                            </a>
                          </li>
                        )
                      )}
                  </React.Fragment>
                );
              })
            )}
          </ul>
        </div>
      </div>
      <div className="ml-64">
        {selectedProduct === "" ? (
          <SummaryDashboard products={selectedProduct} />
        ) : (
          <Dashboard products={selectedProduct} />
        )}
      </div>
    </>
  );
}
