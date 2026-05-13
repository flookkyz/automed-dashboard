import React, { useState, useEffect, useMemo } from "react";
import { Doughnut, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Colors,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import SearchInput from "./scarchInput";
import LoadingState from "./LoadingState";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface DashboardProps {
  mainproduct?: string;
  subproduct?: string;
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

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: "70%",
  plugins: {
    legend: { display: false },
    title: { display: false },
  },
};

const barOptions = {
  responsive: true,
  plugins: {
    legend: { position: "bottom" as const },
    title: { display: false },
  },
  scales: {
    x: { stacked: true, ticks: { display: false } },
    y: { stacked: true },
  },
};

function Dashboard({ mainproduct, subproduct }: DashboardProps) {
  const [detailPopup, setDetailPopup] = useState(false);
  const [headerDetail, setHeaderDetail] = useState("");
  const [nameDetail, setNameDetail] = useState("");
  const [detailTest, setDetailTest] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingDates, setLoadingDates] = useState<boolean>(false);
  const [loadingProduct, setLoadingProduct] = useState<boolean>(false);
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [data, setData] = useState<any[]>([]);
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterText, setFilterText] = useState<string>("");

  const sum = useMemo(() => product?.nametest?.reduce(
    (acc: { pass: number; fail: number; error: number }, curr: NameTest) => ({
      pass: acc.pass + curr.pass,
      fail: acc.fail + curr.fail,
      error: acc.error + curr.error,
    }),
    { pass: 0, fail: 0, error: 0 },
  ), [product]);

  const onDetail = (action: String, data: any, name: string) => {
    setHeaderDetail(action === "fail" ? "Fail" : "Error");
    setNameDetail(name);
    if (data.length === 0) return;
    setDetailPopup(true);
    setDetailTest(data);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedNametest = useMemo(() => product?.nametest
    ? [...product.nametest]
        .filter((item: NameTest) =>
          item.name.toLowerCase().includes(filterText.toLowerCase()),
        )
        .sort((a: any, b: any) => {
          const aValue = a[sortKey];
          const bValue = b[sortKey];
          if (typeof aValue === "string" && typeof bValue === "string") {
            return sortOrder === "asc"
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          }
          return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
        })
    : [], [product, sortKey, sortOrder, filterText]);

  useEffect(() => {
    if (!mainproduct || !subproduct) return;
    let isMounted = true;
    const fetchProducts = async () => {
      setData([]);
      setStartDate(null);
      try {
        setLoadingDates(true);
        setError(null);
        const response = await fetch(
          `/api/getdatefromtest?mainproduct=${mainproduct}&subproduct=${subproduct}`,
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        if (!isMounted) return;
        if (data && data.length > 0) {
          const lastItem = data[data.length - 1];
          setStartDate(new Date(lastItem));
          setData(data);
        } else {
          setStartDate(null);
          setData([]);
        }
      } catch (error: any) {
        if (!isMounted) return;
        setError(error?.message ?? String(error));
      } finally {
        if (isMounted) setLoadingDates(false);
      }
    };
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [mainproduct, subproduct]);

  useEffect(() => {
    let isMounted = true;
    const fetchProduct = async () => {
      if (!mainproduct || !subproduct) return;
      try {
        if (!startDate) return;
        setLoadingProduct(true);
        setError(null);
        setProduct(null);
        const response = await fetch(
          `/api/gettestdata?mainproduct=${mainproduct}&subproduct=${subproduct}&date=${
            startDate.toISOString().split("T")[0]
          }`,
        );
        const data = await response.json();
        if (!isMounted) return;
        setProduct(data);
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError(String(error));
        }
      } finally {
        if (isMounted) setLoadingProduct(false);
      }
    };
    fetchProduct();
    return () => {
      isMounted = false;
    };
  }, [mainproduct, subproduct, startDate]);

  const doughnutChartData = useMemo(() => ({
    labels: ["Pass", "Fail", "Error"],
    datasets: [
      {
        label: "Test Results",
        data: [sum?.pass, sum?.fail, sum?.error],
        backgroundColor: ["#66c552", "#f77575", "#f0f06c"],
      },
    ],
  }), [sum]);

  const barChartData = useMemo(() => ({
    labels: product?.nametest?.map((data: NameTest) => data.name),
    datasets: [
      {
        label: "Pass",
        data: product?.nametest?.map((data: NameTest) => data.pass),
        backgroundColor: "#66c552",
      },
      {
        label: "Fail",
        data: product?.nametest?.map((data: NameTest) => data.fail),
        backgroundColor: "#f77575",
      },
      {
        label: "Error",
        data: product?.nametest?.map((data: NameTest) => data.error),
        backgroundColor: "#f0f06c",
      },
    ],
  }), [product]);

  const isLoading = loadingDates || loadingProduct;
  if (isLoading) {
    return <LoadingState variant="dashboard" label="Loading dashboard..." />;
  }

  return (
    <>
      <div className="p-4">
        <div className="flex justify-between items-center">
          <p className="text-xl font-bold">
            {subproduct && mainproduct
              ? `${mainproduct} > ${subproduct}`
              : "Welcome To Dashboard"}
          </p>
          <div className="flex items-center justify-end">
            <label className="mr-2">Select Date : </label>
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
                includeDates={data}
                disabled={loadingDates}
                dateFormat="dd/MM/yyyy"
                placeholderText="This only includes today and tomorrow"
                className="w-48 text-center border border-b-gray-300 rounded-md pl-9 p-2 bg-white text-black focus:outline-none focus:ring-none relative z-0"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-2 text-red-400">Error: {error}</div>
        ) : null}
        <p className="mb-2 text-center text-2xl font-bold">
          Test Results Distribution
        </p>
        <div className="w-full mt-6 px-12 flex justify-between items-center sm:flex-col md:flex-row">
          {/* Summary cards grid */}

          <div className="w-[30vw] h-full flex flex-col items-center justify-center ">
            {/* Doughnut wrapper: relative so we can overlay center text */}
            <div className="relative w-[20vw] h-[20vw] flex items-center justify-center bg-[#364153] rounded-full p-4">
              <div className="absolute inset-0 flex items-center justify-center">
                <Doughnut data={doughnutChartData} options={doughnutOptions} />
              </div>

              {/* Center overlay text */}
              <div className="absolute text-center text-white pointer-events-none">
                <div className="text-sm mb-2">Test Result</div>
                <div className="text-4xl font-bold">
                  {(() => {
                    const total =
                      (sum?.pass || 0) + (sum?.fail || 0) + (sum?.error || 0);
                    const pct =
                      total > 0
                        ? Math.round(((sum?.pass || 0) / total) * 100)
                        : 0;
                    return `${pct}%`;
                  })()}
                </div>
                <div className="text-sm mt-2">Pass</div>
              </div>
            </div>
          </div>

          <div className="w-[50vw] grid grid-cols-2 gap-6 font-bold">
            {/* Total */}
            <div className="relative rounded-lg p-1 bg-gray-400 overflow-hidden hover:scale-105 transition-transform duration-200">
              <div className="bg-[#364153] hover:bg-gray-400 rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="text-3xl">
                  {(sum?.pass || 0) + (sum?.fail || 0) + (sum?.error || 0)}
                </div>
                <div className="text-lg mt-2 text-gray-200">Total</div>
                {/* faint background icon */}
              </div>
            </div>

            {/* Pass */}
            <div className="relative rounded-lg p-1 bg-[#66c552] overflow-hidden hover:scale-105 transition-transform duration-200">
              <div className="bg-[#364153] hover:bg-[#66c552] rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="text-3xl">{sum?.pass || 0}</div>
                <div className="text-lg mt-2">Pass</div>
                <div className="text-xs text-gray-300 mt-1">
                  {(() => {
                    const total =
                      (sum?.pass || 0) + (sum?.fail || 0) + (sum?.error || 0);
                    const pct =
                      total > 0
                        ? Math.round(((sum?.pass || 0) / total) * 100)
                        : 0;
                    return `Represents ${pct}% of the total`;
                  })()}
                </div>
                <svg
                  className="absolute right-0 top-0 translate-x-10 -translate-y-8 h-32 w-32 opacity-20 text-green-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#66c552"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 8.5L10.5 17l-5-5"
                    stroke="#66c552"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Fail */}
            <div className="relative rounded-lg p-1 bg-[#f77575] overflow-hidden hover:scale-105 transition-transform duration-200">
              <div className="bg-[#364153] hover:bg-[#f77575] rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="text-3xl">{sum?.fail || 0}</div>
                <div className="text-lg mt-2">Fail</div>
                <div className="text-xs text-gray-300 mt-1">
                  {(() => {
                    const total =
                      (sum?.pass || 0) + (sum?.fail || 0) + (sum?.error || 0);
                    const pct =
                      total > 0
                        ? Math.round(((sum?.fail || 0) / total) * 100)
                        : 0;
                    return `Represents ${pct}% of the total`;
                  })()}
                </div>
                <svg
                  className="absolute right-0 top-0 translate-x-10 -translate-y-8 h-32 w-32 opacity-20 text-red-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#f77575"
                    strokeWidth="2"
                  />
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="#f77575"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Error */}
            <div className="relative rounded-lg p-1 bg-[#d09a00] overflow-hidden hover:scale-105 transition-transform duration-200">
              <div className="bg-[#364153] hover:bg-[#d09a00] rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="text-3xl">{sum?.error || 0}</div>
                <div className="text-lg mt-2">Error</div>
                <div className="text-xs text-gray-300 mt-1">
                  {(() => {
                    const total =
                      (sum?.pass || 0) + (sum?.fail || 0) + (sum?.error || 0);
                    const pct =
                      total > 0
                        ? Math.round(((sum?.error || 0) / total) * 100)
                        : 0;
                    return `Represents ${pct}% of the total`;
                  })()}
                </div>
                <svg
                  className="absolute right-0 top-0 translate-x-10 -translate-y-8 h-32 w-32 opacity-20 text-yellow-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#d09a00"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 8v5"
                    stroke="#d09a00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 16h.01"
                    stroke="#d09a00"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            
          </div>
          
        </div>
        
      </div>
      
      {/* <div className="px-4 py-8 flex justify-center mt-[-70px] mb-[-90px]">
        <div className="flex w-3/4 h-96 items-center justify-between">
          <div className="w-3/4 h-full ml-24 flex flex-col items-center justify-center">
            <Bar data={barChartData} options={barOptions} />
          </div>
        </div>
      </div> */}
      <div className="p-4 md:p-8 overflow-x-auto">
        <div className="mb-4 flex justify-between items-center flex-col">
          <h2 className="text-xl font-bold justify-start w-full mb-4">
            Test Results Table
          </h2>
          <div className="flex items-center justify-start w-full">
            <label className="mr-2 font-medium">Filter by Name Test :</label>
            <div className="w-64">
              <SearchInput
                placeholder="Search Name Test..."
                value={filterText}
                onChange={(value) => setFilterText(value)}
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full mt-6 font-bold rounded-lg overflow-hidden min-w-[800px]">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th
                style={{ width: "40%" }}
                className="py-2 px-4 cursor-pointer"
                onClick={() => handleSort("name")}
              >
                Name Test{" "}
                {sortKey === "name" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "8%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("pass")}
              >
                Pass{" "}
                {sortKey === "pass" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "8%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("fail")}
              >
                Fail{" "}
                {sortKey === "fail" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "8%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("error")}
              >
                Error{" "}
                {sortKey === "error" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "8%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("total")}
              >
                Total{" "}
                {sortKey === "total" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "9%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("time")}
              >
                Duration(s){" "}
                {sortKey === "time" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
              <th
                style={{ width: "9%" }}
                className="py-2 cursor-pointer"
                onClick={() => handleSort("time")}
              >
                Test Time{" "}
                {sortKey === "time" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedNametest?.map((data: NameTest, index: number) => (
              <tr key={index} className="bg-gray-500 hover:bg-gray-600">
                <td style={{ width: "40%" }} className="py-2 px-4 break-words">
                  {data.name}
                </td>
                <td style={{ width: "8%" }} className="py-2 text-center">
                  {data.pass}
                </td>
                {data.fail > 0 ? (
                  <td
                    style={{ width: "8%" }}
                    className="py-2 text-center bg-[#f77575] cursor-pointer text-gray-800"
                    onClick={() => onDetail("fail", data.detailfail, data.name)}
                  >
                    {data.fail}
                  </td>
                ) : (
                  <td style={{ width: "8%" }} className="py-2 text-center">
                    {data.fail}
                  </td>
                )}
                {data.error > 0 ? (
                  <td
                    style={{ width: "8%" }}
                    className="py-2 text-center bg-[#f0f06c] cursor-pointer text-gray-800"
                    onClick={() =>
                      data.detailerror
                        ? onDetail("error", data.detailerror, data.name)
                        : null
                    }
                  >
                    {data.error}
                  </td>
                ) : (
                  <td style={{ width: "8%" }} className="py-2 text-center">
                    {data.error}
                  </td>
                )}
                <td style={{ width: "8%" }} className="py-2 text-center">
                  {data.pass + data.fail + data.error}
                </td>
                <td style={{ width: "9%" }} className="py-2 text-center">
                  {data.time}
                </td>
                <td style={{ width: "9%" }} className="py-2 text-center">
                  {product.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {detailPopup && (
        <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-500 w-full max-w-4xl h-5/6 max-h-[90vh] rounded-xl p-4 md:p-8 flex flex-col overflow-hidden">
            <div className="text-lg md:text-xl text-center font-bold truncate px-2">{nameDetail}</div>
            <div className="text-lg md:text-xl text-center font-bold mb-4">
              {headerDetail} Detail
            </div>
            <div className="w-full flex-1 overflow-hidden">
              <table className="w-full table-fixed">
                <thead>
                  {detailTest[0].name ? (
                    <tr className="bg-gray-800 text-white">
                      <th className="py-2 px-4 w-1/2 ">name test</th>
                      <th className="py-2 px-4 ">detail</th>
                    </tr>
                  ) : (
                    <tr className="bg-gray-800 text-white">
                      <th className="py-2 px-4 ">detail</th>
                    </tr>
                  )}
                </thead>
              </table>
              <div className="overflow-y-auto" style={{maxHeight: 'calc(100% - 50px)'}}>
                <table className="w-full table-fixed">
                  <tbody>
                    {Array.isArray(detailTest) &&
                      detailTest.map((item: any, index: number) => (
                        <>
                          {item.name ? (
                            <tr
                              key={index}
                              className="bg-gray-600 hover:bg-gray-700 text-white"
                            >
                              <td className="py-2 px-4 w-1/2 break-words align-top">
                                {item.name.replace("Place Order Tests ›", "")}
                              </td>
                              <td className="py-2 px-4 border-l border-black break-words align-top">
                                <div className="break-all">
                                  {item.error.split("Call log")[0]}
                                  <br />
                                  {item.error.split("Call log")[1]
                                    ? `Call log ${
                                        item.error.split("Call log")[1]
                                      }`
                                    : null}
                                </div>
                                {item.expected ? (
                                  <div className="text-green-500 break-all mt-2">
                                    Expected: {item.expected}
                                  </div>
                                ) : null}
                                {item.received ? (
                                  <div className="text-red-500 break-all mt-2">
                                    Received: {item.received}
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ) : (
                            <tr
                              key={index}
                              className="bg-gray-600 hover:bg-gray-700 text-white"
                            >
                              <td className="py-2 px-4 break-words">{item}</td>
                            </tr>
                          )}
                        </>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-center mt-6 flex flex-row">
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-md"
                onClick={() => setDetailPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
