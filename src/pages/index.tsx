"use client";
import { useState, useEffect } from 'react';
import SummaryDashboard from '../components/SummaryDashboard';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [originalProducts, setOriginalProducts] = useState<any[]>([]);

  let datetest = [
    "2025-01-27",
    "2025-01-28",
    "2025-01-29",
    "2025-01-30",
    "2025-01-31",
    "2025-02-04",
    "2025-02-05",
    "2025-02-06",
    "2025-02-07",
    "2025-02-10",
    "2025-02-11",
    "2025-02-13",
    "2025-02-14",
    "2025-02-17",
    "2025-02-18",
    "2025-02-19",
    "2025-02-20",
    "2025-02-24",
    "2025-02-25",
    "2025-02-26",
    "2025-02-28",
    "2025-03-03",
    "2025-03-04",
    "2025-03-05",
    "2025-03-06",
    "2025-03-07",
    "2025-03-12"
  ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const onSelectProduct = (product: any) => {
    setSelectedProduct(product);
  };


  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/getproductname');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setProducts(data.collectionNames);
        setOriginalProducts(data.collectionNames);
        setProducts(data.collectionNames);

      } catch (error: any) {
        setError(error.message);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch('/api/getproductname');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setProducts(data.collectionNames);
        setOriginalProducts(data.collectionNames);
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
          <div className='flex items-center justify-center mt-2'>
          <input
            type="text"
            placeholder="Filter products"
            className="w-[90%] p-2 mb-2 ring-0 border-0 rounded rounded-md p-2 bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-0 focus:ring-blue-400 focus:border-transparent"
            onChange={(e) => {
              const filter = e.target.value.toLowerCase();
              setProducts(
                originalProducts.filter((product) =>
                  product.toLowerCase().includes(filter)
                )
              );
            }}
          />
          </div>
          <ul>
            {products.length === 0 ? (
              <li className="block pt-4 p-2 border-b border-gray-600 dark:border-gray-400 border-b-2">
                No products available
              </li>
            ) : (
              products.map((product, index) => (
                <li key={index}>
                  <a className="block pt-4 p-2 border-b border-gray-600 dark:border-gray-400 border-b-2 hover:bg-gray-700 cursor-pointer"
                    onClick={() => onSelectProduct(product)}
                  >
                    {product}
                  </a>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className='ml-64'>
        {selectedProduct === '' ? <SummaryDashboard products={selectedProduct} date={date} /> : <Dashboard products={selectedProduct} />}
      </div>
    </>
  );
}


