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
          <ul>
            {products?.map((product, index) => (
              <li key={index}>
                <a className="block pt-4 p-2 border-b border-gray-600 dark:border-gray-400 border-b-2 hover:bg-gray-700 cursor-pointer" onClick={() => onSelectProduct(product)}>
                  {product}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className='ml-64'>
        <div className='flex items-center justify-between mb-4 p-4'>
          <p className='text-xl font-bold'>{selectedProduct ? selectedProduct : "Welcome To Dashbaord"}</p>
          <div>
            <label htmlFor="date" className="mr-2">Select Date:</label>
            <input
              type="date"
              id="date"
              className="border border-gray-300 rounded-md p-2 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-400"
              value={date.toISOString().split('T')[0]}
              onChange={(e) => setDate(new Date(e.target.value))}
              style={{ colorScheme: 'light dark' }}
            />
          </div>
        </div>
        {selectedProduct === '' ? <SummaryDashboard products={selectedProduct} date={date} /> : <Dashboard products={selectedProduct} date={date} />}
      </div>
    </>
  );
}


