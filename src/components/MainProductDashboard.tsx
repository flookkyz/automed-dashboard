import React, { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useRouter } from "next/router";
import SearchInput from "./scarchInput";
import LoadingState from "./LoadingState";

ChartJS.register(CategoryScale, LinearScale, ArcElement, Tooltip, Legend);

type NameTest = {
  name?: string;
  pass?: number;
  fail?: number;
  error?: number;
  time?: string;
};

type LatestDoc = {
  date?: string;
  time?: string;
  mainproduct?: string;
  nametest?: NameTest[];
  [key: string]: any;
};

type ApiSubproductItem = {
  subproduct: string;
  latest: LatestDoc | null;
};

type ApiResponse = {
  mainProduct: string;
  subproducts: ApiSubproductItem[];
  errors: Array<{ subproduct?: string; error: string }>;
};

type Totals = { pass: number; fail: number; error: number };

type Row = {
  subproduct: string;
  pass: number;
  fail: number;
  error: number;
  total: number;
  date: string;
  time: string;
};

function sumDoc(doc: LatestDoc | null): Totals {
  const base: Totals = { pass: 0, fail: 0, error: 0 };
  if (!doc || !Array.isArray(doc.nametest)) return base;

  return doc.nametest.reduce<Totals>(
    (acc, cur) => {
      acc.pass += typeof cur.pass === "number" ? cur.pass : 0;
      acc.fail += typeof cur.fail === "number" ? cur.fail : 0;
      acc.error += typeof cur.error === "number" ? cur.error : 0;
      return acc;
    },
    { ...base }
  );
}

export default function MainProductDashboard({
  mainproduct,
}: {
  mainproduct?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [filterText, setFilterText] = useState<string>("");

  useEffect(() => {
    if (!mainproduct) return;

    let isMounted = true;
    const fetchMain = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(
          `/api/getmainproductdata?mainProduct=${encodeURIComponent(mainproduct)}`
        );
        if (!resp.ok) {
          const msg = await resp.text();
          throw new Error(msg || `Request failed: ${resp.status}`);
        }
        const json = (await resp.json()) as ApiResponse;
        if (!isMounted) return;
        setData(json);
      } catch (e: any) {
        if (!isMounted) return;
        setError(e?.message ? String(e.message) : String(e));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMain();
    return () => {
      isMounted = false;
    };
  }, [mainproduct]);

  const rows = useMemo<Row[]>(() => {
    const subs = data?.subproducts ?? [];
    return subs
      .map((s) => {
        const totals = sumDoc(s.latest);
        return {
          subproduct: s.subproduct,
          pass: totals.pass,
          fail: totals.fail,
          error: totals.error,
          total: totals.pass + totals.fail + totals.error,
          date: s.latest?.date ?? "",
          time: s.latest?.time ?? "",
        };
      })
      .sort((a, b) => a.subproduct.localeCompare(b.subproduct));
  }, [data]);

  const overall = useMemo<Totals>(() => {
    return rows.reduce(
      (acc, r) => {
        acc.pass += r.pass;
        acc.fail += r.fail;
        acc.error += r.error;
        return acc;
      },
      { pass: 0, fail: 0, error: 0 }
    );
  }, [rows]);

  const doughnutChartData = useMemo(
    () => ({
      labels: ["Pass", "Fail", "Error"],
      datasets: [
        {
          label: "Test Results",
          data: [overall.pass, overall.fail, overall.error],
          backgroundColor: ["#66c552", "#f77575", "#f0f06c"],
        },
      ],
    }),
    [overall]
  );

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
    }),
    []
  );

  const title = mainproduct ? `${mainproduct} (Overview)` : "Overview";
  const totalAll = overall.pass + overall.fail + overall.error;

  const today = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const filteredRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.subproduct.toLowerCase().includes(q));
  }, [rows, filterText]);

  if (!mainproduct) {
    return (
      <div className="p-4">
        <div className="col-span-3 flex flex-col items-center justify-center h-96">
          <p className="font-bold text-2xl text-white">Main product not selected</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <div className="flex justify-between items-center">
          <p className="text-xl font-bold">{title}</p>
        </div>

        {loading ? (
          <LoadingState variant="overview" label="Loading overview..." />
        ) : error ? (
          <div className="p-4 text-red-400">Error: {error}</div>
        ) : (
          <>
            <p className="mb-2 text-center text-2xl font-bold">
              Test Results Distribution
            </p>

            <div className="w-full mt-6 px-12 flex justify-between items-center sm:flex-col md:flex-row">
              <div className="w-[30vw] h-full flex flex-col items-center justify-center ">
                <div className="relative w-[20vw] h-[20vw] flex items-center justify-center bg-[#364153] rounded-full p-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Doughnut data={doughnutChartData} options={doughnutOptions} />
                  </div>

                  <div className="absolute text-center text-white pointer-events-none">
                    <div className="text-sm mb-2">Test Result</div>
                    <div className="text-4xl font-bold">
                      {(() => {
                        const pct = totalAll > 0 ? Math.round((overall.pass / totalAll) * 100) : 0;
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
                    <div className="text-3xl">{totalAll}</div>
                    <div className="text-lg mt-2 text-gray-200">Total</div>
                  </div>
                </div>

                {/* Pass */}
                <div className="relative rounded-lg p-1 bg-[#66c552] overflow-hidden hover:scale-105 transition-transform duration-200">
                  <div className="bg-[#364153] hover:bg-[#66c552] rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden">
                    <div className="text-3xl">{overall.pass}</div>
                    <div className="text-lg mt-2">Pass</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {(() => {
                        const pct = totalAll > 0 ? Math.round((overall.pass / totalAll) * 100) : 0;
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
                    <div className="text-3xl">{overall.fail}</div>
                    <div className="text-lg mt-2">Fail</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {(() => {
                        const pct = totalAll > 0 ? Math.round((overall.fail / totalAll) * 100) : 0;
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
                    <div className="text-3xl">{overall.error}</div>
                    <div className="text-lg mt-2">Error</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {(() => {
                        const pct = totalAll > 0 ? Math.round((overall.error / totalAll) * 100) : 0;
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

            <div className="p-4 md:p-8 overflow-x-auto">
              <h2 className="text-xl font-bold justify-start w-full mb-4">
                Subproducts
              </h2>

              <div className="mb-4 flex items-center justify-start w-full">
                <label className="mr-2 font-medium">Search Subproduct :</label>
                <div className="w-64">
                  <SearchInput
                    placeholder="Search subproduct..."
                    value={filterText}
                    onChange={(value) => setFilterText(value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full mt-6 font-bold rounded-lg overflow-hidden min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th style={{ width: "40%" }} className="py-2 px-4 text-left">
                        Subproduct
                      </th>
                      <th style={{ width: "8%" }} className="py-2 text-center">
                        Pass
                      </th>
                      <th style={{ width: "8%" }} className="py-2 text-center">
                        Fail
                      </th>
                      <th style={{ width: "8%" }} className="py-2 text-center">
                        Error
                      </th>
                      <th style={{ width: "8%" }} className="py-2 text-center">
                        Total
                      </th>
                      <th style={{ width: "28%" }} className="py-2 px-4 text-left">
                        Latest Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr className="bg-gray-500">
                        <td className="py-3 px-4" colSpan={6}>
                          No subproducts found
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => (
                        <tr
                          key={r.subproduct}
                          className="bg-gray-500 hover:bg-gray-600 cursor-pointer"
                          onClick={() => router.push(`/${mainproduct}/${r.subproduct}`)}
                        >
                          <td className="py-2 px-4 break-words">{r.subproduct}</td>
                          <td className="py-2 text-center">{r.pass}</td>
                          {r.fail > 0 ? (
                            <td className="py-2 text-center bg-[#f77575] text-gray-800">
                              {r.fail}
                            </td>
                          ) : (
                            <td className="py-2 text-center">{r.fail}</td>
                          )}
                          {r.error > 0 ? (
                            <td className="py-2 text-center bg-[#f0f06c] text-gray-800">
                              {r.error}
                            </td>
                          ) : (
                            <td className="py-2 text-center">{r.error}</td>
                          )}
                          <td className="py-2 text-center">{r.total}</td>
                          <td className="py-2 px-4 break-words">
                            {r.date ? (
                              <>
                                {`${r.date}${r.time ? ` (${r.time})` : ""}`}
                                {r.date !== today && (
                                  <span className="ml-2 text-xs text-yellow-200">
                                    Not today
                                  </span>
                                )}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {Array.isArray(data?.errors) && data!.errors.length > 0 && (
                <div className="mt-4 text-yellow-200">
                  Some subproducts could not be queried.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
