import React, { useState, useEffect, useMemo } from "react";
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

interface NameTest {
  name: string;
  pass: number;
  fail: number;
  error: number;
  time: string;
  mainproduct: string;
  detailfail: object[];
  detailerror: object[];
}

function SummaryDashboard() {
  const [error, setError] = useState<string | null>(null);
  const [sumresult, setSumresult] = useState<
    { pass: number; fail: number; error: number; name: string }[]
  >([]);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<"all" | "fail" | "error">("all");
  const router = useRouter();

  const handleProductClick = (product: NameTest) => {
    router.push(`/${product.mainproduct}/${product.name}`);
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

        let finaldata: { key: string; value: any }[] = [];
        Object.keys(data).forEach(function (key) {
          let newdata = { key: key, value: data[key] };
          if (newdata.value) {
            finaldata.push(newdata);
          }
        });

        let sumresult: {
          pass: number;
          fail: number;
          error: number;
          name: string;
          mainproduct: string;
        }[] = [];
        if (finaldata.length === 0) {
          sumresult.push({
            pass: 0,
            fail: 0,
            error: 0,
            name: "nodata",
            mainproduct: "",
          });
        } else {
          finaldata.forEach((item) => {
            const sum = (item?.value.nametest ?? []).reduce(
              (
                acc: {
                  pass: number;
                  fail: number;
                  error: number;
                  name: string;
                  mainproduct: string;
                },
                curr: NameTest
              ) => ({
                pass: acc.pass + curr.pass,
                fail: acc.fail + curr.fail,
                error: acc.error + curr.error,
                name: item.key,
                mainproduct: item.value.mainproduct || "",
              }),
              {
                pass: 0,
                fail: 0,
                error: 0,
                name: item.key,
                mainproduct: item.value.mainproduct || "",
              }
            );
            sumresult.push(sum);
          });
          sumresult.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (!isMounted) return;

        setSumresult(sumresult);
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
  }, [startDate]); // Remove startDate dependency if causing issues

  const doughnutOptions = {
    responsive: true,
    onClick: (event: any, elements: any) => {
      if (elements && elements.length > 0) {
        // Get the product name from the chart context
        const chart = event.chart;
        const productName = chart.canvas.getAttribute("data-product-name");
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

  const filteredSumresult = useMemo(() => sumresult.filter((item: any) => {
    if (filter === "all") return true;
    if (filter === "fail") return item.fail > 0;
    if (filter === "error") return item.error > 0;
    return true;
  }), [sumresult, filter]);

  return (
    <>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex justify-center text-white font-bold text-l">
            <div
              className={`w-[5vw] p-2 border rounded-l-lg text-center ${
                filter === "all" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
              } cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => setFilter("all")}
            >
              All
            </div>
            <div
              className={`w-[5vw] p-2 border text-center ${
                filter === "fail" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
              } cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => setFilter("fail")}
            >
              Fail
            </div>
            <div
              className={`w-[5vw] p-2 border rounded-r-lg text-center ${
                filter === "error" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
              } cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={() => setFilter("error")}
            >
              Error
            </div>
          </div>
          <div>
            <label className="mr-2">Select Date : </label>
            {/* DatePicker with inline calendar icon */}
            <div className="relative inline-block cursor-pointer">
              <svg
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none h-5 w-5 z-10"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2.5"
                />
                <path
                  d="M16 3v4M8 3v4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
              <DatePicker
                selected={startDate}
                onChange={(date) => {
                  setStartDate(date);
                }}
                dateFormat="dd/MM/yyyy"
                maxDate={new Date()}
                className="w-48 text-center border border-b-gray-300 rounded-md pl-9 p-2 bg-white text-black focus:outline-none focus:ring-none relative z-0"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {sumresult.length === 1 && sumresult[0].name === "nodata" ? (
            <div className="col-span-3 flex flex-col items-center justify-center h-96">
              <p className="font-bold text-2xl text-white">Data not found 🤩</p>
            </div>
          ) : (
            (() => {
              if (filteredSumresult.length === 0) {
                return (
                  <div className="col-span-3 flex flex-col items-center justify-center h-96">
                    <p className="font-bold text-2xl text-white">No Data 🤩</p>
                  </div>
                );
              }

              return filteredSumresult.map((test: any, index: number) => {
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
                    handleProductClick(test);
                  },
                };

                return (
                  <div
                    key={index}
                    className="w-[80%] h-[80%] flex flex-col items-center justify-center ml-[2vw] mb-6"
                  >
                    <p className="font-bold text-[1.5vw]">{test.name}</p>
                    <div
                      className="cursor-pointer hover:opacity-80 transition-opacity w-[20vw] h-[20vw]"
                      onClick={() => handleProductClick(test)}
                    >
                      {/* Styled doughnut similar to Dashboard.tsx: dark circular background, thicker ring, center overlay */}
                      <div className="relative w-full h-full flex items-center justify-center bg-[#364153] rounded-full p-4 mt-4">
                        <div className="absolute inset-0 flex items-center justify-center hover:scale-105 transition-transform duration-200">
                          <Doughnut
                            data={doughnutChartData}
                            options={{
                              ...chartOptions,
                              maintainAspectRatio: false,
                              cutout: "70%",
                              plugins: {
                                ...chartOptions.plugins,
                                legend: { display: false },
                                title: { display: false },
                              },
                            }}
                          />
                        </div>

                        <div className="absolute text-center text-white pointer-events-none">
                          <div className="text-[1vw] mb-2">Test Result</div>
                          <div className="text-[2vw] font-bold">
                            {(() => {
                              const total =
                                (test.pass || 0) +
                                (test.fail || 0) +
                                (test.error || 0);
                              const pct =
                                total > 0
                                  ? Math.round(((test.pass || 0) / total) * 100)
                                  : 0;
                              return `${pct}%`;
                            })()}
                          </div>
                          <div className="text-[1vw] mt-2">Pass</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      </div>
    </>
  );
}

export default SummaryDashboard;
