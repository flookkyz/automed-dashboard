import React, { useState, useEffect } from 'react';

function navbar() {
    const [isOpen, setIsOpen] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [products, setProducts] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [date, setDate] = useState(new Date());

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const onSelectProduct = (product: any) => {
        setSelectedProduct(product);
    }

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch('/api/getproductname');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();

                setProducts(data.collectionNames);

            } catch (error: any) {
                setError(error.message);
            }
        };

        fetchProducts();
    }, []);

    return (
        <>
            <div className="fixed left-0 top-0 w-64 h-screen bg-gray-800 text-white overflow-y-auto">
                <div className="p-4">
                    <h1 className="text-2xl font-bold cursor-pointer" onClick={() => onSelectProduct("")}>Dashboard</h1>
                </div>
                <div className="py-2 px-2 flex flex-row items-center justify-between hover:bg-gray-700">
                    <p>Product</p>
                    <button
                        className="flex items-start justify-start w-full py-2"
                        onClick={toggleMenu}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-6 w-6 transform transition duration-200 ease-in-out"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={isOpen ? "M9 5l7 7 7 -7" : "M9 5l7 7 -7 7"}
                            />
                        </svg>

                    </button>
                </div>
                <div
                    className={`overflow-y-auto ${isOpen ? 'block' : 'hidden'}`}
                >
                    <input
                        type="text"
                        placeholder="Filter products"
                        className="w-full p-2 mb-2 border border-gray-600 dark:border-gray-400 rounded"
                        onChange={(e) => {
                            const filter = e.target.value.toLowerCase();
                            setProducts((prevProducts) =>
                                prevProducts.filter((product) =>
                                    product.toLowerCase().includes(filter)
                                )
                            );
                        }}
                    />
                    <ul>
                        {products?.map((product, index) => (
                            <li key={index}>
                                <a className="block pt-4 p-2 border-b border-gray-600 dark:border-gray-400 border-b-2 hover:bg-gray-700 cursor-pointer" href={`/${product}`}
                                // onClick={() => onSelectProduct(product)}
                                >
                                    {product}
                                </a>
                            </li>
                        ))}
                    </ul>
            </div>
        </div >
        </>
    );
}

export default navbar;
