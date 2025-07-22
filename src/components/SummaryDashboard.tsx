import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useRouter } from "next/router";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardProps {
  products: string;
  onSelectProduct: (product: string) => void;
}

interface NameTest {
  name: string;
  pass: number;
  fail: number;
  error: number;
  time: string;
  detailfail: object[];
  detailerror: object[];
}

function SummaryDashboard({ products, onSelectProduct }: DashboardProps) {
  const [error, setError] = useState<string | null>(null);
  const [sumresult, setSumresult] = useState<
    { pass: number; fail: number; error: number; name: string }[]
  >([]);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleProductClick = (productName: string) => {
    router.push(`/${productName}`);
  };

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts
    
    const fetchProduct = async () => {
      if (loading) return; // Prevent multiple simultaneous calls
      
      try {
        if (!startDate) {
          throw new Error("Start date is not selected");
        }
        
        setLoading(true);
        setError(null);
        const response = await fetch(
          `/api/getsummary?date=${startDate.toISOString().split("T")[0]}`
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        console.log("data", data);

        let finaldata: { key: string; value: any }[] = [];
        Object.keys(data).forEach(function (key, index) {
          let newdata = { key: key, value: data[key] };
          if (newdata.value) {
            finaldata.push(newdata);
          }
        });
        console.log("finaldata", finaldata);

        let sumresult: {
          pass: number;
          fail: number;
          error: number;
          name: string;
        }[] = [];
        if (finaldata.length === 0) {
          sumresult.push({ pass: 0, fail: 0, error: 0, name: "nodata" });
        } else {
          finaldata.forEach((item) => {
            console.log("item", item.key);
            const sum = item?.value.nametest.reduce(
              (
                acc: { pass: number; fail: number; error: number },
                curr: NameTest
              ) => ({
                pass: acc.pass + curr.pass,
                fail: acc.fail + curr.fail,
                error: acc.error + curr.error,
                name: item.key,
              }),
              { pass: 0, fail: 0, error: 0, name: "" }
            );
            sumresult.push(sum);
          });
          sumresult.sort((a, b) => a.name.localeCompare(b.name));
        }
        
        if (!isMounted) return; // Don't update state if component unmounted
        
        setSumresult(sumresult);
        console.log("sumresult", sumresult);
      } catch (error) {
        if (!isMounted) return; // Don't update state if component unmounted
        
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError(String(error));
        }
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: (error as Error).message,
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchProduct();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [products, startDate]); // Remove startDate dependency if causing issues

  const doughnutOptions = {
    responsive: true,
    onClick: (event: any, elements: any) => {
      if (elements && elements.length > 0) {
        // Get the product name from the chart context
        const chart = event.chart;
        const productName = chart.canvas.getAttribute('data-product-name');
        if (productName) {
          handleProductClick(productName);
        }
      }
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          color: "#b9bab8", // Change this to your desired color
        },
      },
      title: {
        display: true,
        color: "#b9bab8", // Change this to your desired color
      },
    },
  };

  return (
    <>
      <div className="p-4">
        <div className="flex items-center justify-end mb-2">
          <label className="mr-2">Select Date : </label>
          <DatePicker
            selected={startDate}
            onChange={(date) => {
              setStartDate(date);
            }}
            className="border border-b-gray-300 rounded-md p-2 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-400"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {sumresult.length === 1 && sumresult[0].name === "nodata" ? (
            <div className="col-span-3 flex flex-col items-center justify-center h-96">
              <p className="font-bold text-2xl text-white">Data not found ☹️</p>
            </div>
          ) : (
            sumresult.map((test: any, index: number) => {
              const doughnutChartData = {
                labels: ["Pass", "Fail", "Error"],
                datasets: [
                  {
                    label: "Test Results",
                    data: [test.pass, test.fail, test.error],
                    backgroundColor: ["#66c552", "#f77575", "#f0f06c"],
                  },
                ],
              };
              
              const chartOptions = {
                ...doughnutOptions,
                onClick: (event: any, elements: any) => {
                  handleProductClick(test.name);
                }
              };

              return (
                <div
                  key={index}
                  className="w-full h-[100%] flex flex-col items-center justify-center mb-6"
                >
                  <p className="font-bold text-xl">{test.name}</p>
                  <div 
                    className="cursor-pointer hover:opacity-80 transition-opacity w-[350px] h-[350px]"
                    onClick={() => handleProductClick(test.name)}
                  >
                    <Doughnut
                      data={doughnutChartData}
                      options={chartOptions}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default SummaryDashboard;
