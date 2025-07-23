import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

function navbar() {
    const [isOpen, setIsOpen] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [newProducts, setNewProducts] = useState<any[]>([]);
    const [originalNewProducts, setOriginalNewProducts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [openIndexes, setOpenIndexes] = useState<{ [key: string]: boolean }>({});
    const [productFailStatus, setProductFailStatus] = useState<{ [key: string]: boolean }>({});
    const router = useRouter();

    // Keep dropdown state persistent
    const keepDropdownOpen = (currentSelectedProduct: string, newProducts: any[]) => {
        if (currentSelectedProduct) {
            // Find which main product contains this sub-product
            const parentProduct = newProducts.find(product => 
                product.subProduct?.includes(currentSelectedProduct)
            );
            if (parentProduct) {
                setOpenIndexes(prev => ({
                    ...prev,
                    [parentProduct.mainProduct]: true
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

    const onSelectProduct = (product: string) => {
        setSelectedProduct(product);
        if (product === "") {
            router.push('/');
        } else {
            router.push(`/${product}`);
        }
        // Don't close the dropdown when selecting sub-product
    }

    useEffect(() => {
        const fetchNewProducts = async () => {
            try {
                const response = await fetch('/api/getnewproductname');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
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
            }
        };

        fetchNewProducts();
    }, []);

    const fetchProductFailStatus = async (products: any[]) => {
        const today = new Date().toISOString().split('T')[0];
        const failStatus: { [key: string]: boolean } = {};
        
        try {
            // Check main products
            for (const product of products) {
                if (product.mainProduct) {
                    try {
                        const response = await fetch(`/api/gettestdata?nameproduct=${product.mainProduct}&date=${today}`);
                        if (response.ok) {
                            const data = await response.json();
                            const hasFail = data.nametest?.some((test: any) => test.fail > 0) || false;
                            failStatus[product.mainProduct] = hasFail;
                        }
                    } catch (error) {
                        console.log(`Error checking ${product.mainProduct}:`, error);
                        failStatus[product.mainProduct] = false;
                    }
                }
                
                // Check sub products
                if (product.subProduct) {
                    for (const subProduct of product.subProduct) {
                        try {
                            const response = await fetch(`/api/gettestdata?nameproduct=${subProduct}&date=${today}`);
                            if (response.ok) {
                                const data = await response.json();
                                const hasFail = data.nametest?.some((test: any) => test.fail > 0) || false;
                                failStatus[subProduct] = hasFail;
                            }
                        } catch (error) {
                            console.log(`Error checking ${subProduct}:`, error);
                            failStatus[subProduct] = false;
                        }
                    }
                }
            }
            
            setProductFailStatus(failStatus);
        } catch (error) {
            console.log('Error fetching product fail status:', error);
        }
    };

    // Set selected product based on current route
    useEffect(() => {
        if (router.query.slug) {
            setSelectedProduct(router.query.slug.toString());
            // Keep dropdown open for sub-products
            if (newProducts.length > 0) {
                keepDropdownOpen(router.query.slug.toString(), newProducts);
            }
        } else {
            setSelectedProduct("");
        }
        // Don't reset openIndexes when route changes
    }, [router.query.slug, newProducts]);

    return (
        <>
            <div className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-auto">
                <div className="p-4">
                    <h1 
                        className="text-2xl font-bold cursor-pointer p-2 rounded" 
                        onClick={() => onSelectProduct("")}
                    >
                        Dashboard
                    </h1>
                </div>
                <div className={`overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}>
                    <div className="flex items-center justify-center mt-2">
                        <input
                            type="text"
                            placeholder="Filter products"
                            className="w-[90%] p-2 mb-2 ring-0 border-0 rounded rounded-md p-2 bg-white text-black dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-0 focus:ring-blue-400 focus:border-transparent"
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
                                const isOpenSub = openIndexes[product.mainProduct] || false;
                                const mainProductHasFail = productFailStatus[product.mainProduct] || false;
                                
                                // Check if any sub-products have fails
                                const hasSubProductFail = product.subProduct?.some((sub: string) => 
                                    productFailStatus[sub] || false
                                ) || false;
                                
                                // Main product should be red if it has fails OR any sub-product has fails
                                const shouldShowRed = mainProductHasFail || hasSubProductFail;
                                
                                return (
                                    <React.Fragment key={index}>
                                        <li>
                                            <div
                                                className={`flex items-center justify-between block pt-4 p-2 border-b-2 border-gray-600 dark:border-gray-600 cursor-pointer ${
                                                    selectedProduct === product.mainProduct
                                                        ? "bg-gray-600 text-blue-300"
                                                        : shouldShowRed
                                                        ? "hover:bg-red-700 bg-red-600"
                                                        : "hover:bg-gray-700"
                                                }`}
                                                onClick={() => handleToggleSub(product.mainProduct)}
                                            >
                                                <span className={shouldShowRed ? "text-red-200" : ""}>
                                                    {shouldShowRed && "⚠️ "}
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
                                                    const subProductHasFail = productFailStatus[subProduct] || false;
                                                    
                                                    return (
                                                        <li key={`${index}-${subIndex}`}>
                                                            <a
                                                                className={`block pl-8 pt-2 p-2 border-b border-gray-600 dark:border-gray-600 cursor-pointer ${
                                                                    selectedProduct === subProduct
                                                                        ? "bg-gray-600 text-blue-300"
                                                                        : subProductHasFail
                                                                        ? "hover:bg-red-700 bg-red-600 text-red-200"
                                                                        : "hover:bg-gray-700"
                                                                }`}
                                                                onClick={() => onSelectProduct(subProduct)}
                                                            >
                                                                {subProductHasFail && "⚠️ "}
                                                                {subProduct}
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
            </div >
        </>
    );
}

export default navbar;
