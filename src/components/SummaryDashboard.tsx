import React, { useEffect, useMemo, useState } from "react";
import { Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoadingState from "./LoadingState";

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const RANGE_DAYS = 14;

const SURFACE = "#2f3a4a";
const COLOR_PASS = "#66c552";
const COLOR_NOTPASS = "#e05252";
const COLOR_NODATA = "#a8b4c4";
const COLOR_LINE = "#3f9ae0";

type SummaryEntry = {
  mainproduct?: string;
  subproduct?: string;
  time?: string;
  nametest?: Array<{ pass?: number; fail?: number; error?: number }>;
};

type SummaryByDate = Record<string, Record<string, SummaryEntry>>;

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function hasTestResult(entry: SummaryEntry): boolean {
  return Array.isArray(entry?.nametest) && entry.nametest.length > 0;
}

function formatPercent(value: number, total: number): string {
  if (total <= 0 || value <= 0) return "0%";
  const pct = (value / total) * 100;
  return pct < 1 ? "<1%" : `${Math.round(pct)}%`;
}

function isAllPass(entry: SummaryEntry): boolean {
  let fail = 0;
  let error = 0;
  for (const t of entry.nametest ?? []) {
    fail += typeof t.fail === "number" ? t.fail : 0;
    error += typeof t.error === "number" ? t.error : 0;
  }
  return fail === 0 && error === 0;
}

/* [old]
function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-600 bg-[#2f3a4a] p-5">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}26`, color: accent }}
      >
        {icon}
      </span>
      <div className="mt-4 text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-gray-300">{label}</div>
    </div>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-6 w-6",
  "aria-hidden": true,
};

const IconTotal = (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const IconNoData = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);

const IconPass = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);

const IconNotPass = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15 9l-6 6M9 9l6 6" />
  </svg>
);
*/

function CardIcon({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <svg
      className="absolute right-0 top-0 translate-x-10 -translate-y-8 h-32 w-32 opacity-20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  borderClass,
  hoverClass,
  icon,
}: {
  label: string;
  value: number;
  sub?: string;
  borderClass: string;
  hoverClass: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-lg p-1 overflow-hidden hover:scale-105 transition-transform duration-200 ${borderClass}`}
    >
      <div
        className={`bg-[#364153] rounded-lg p-6 h-32 flex flex-col items-center justify-center text-white relative overflow-hidden ${hoverClass}`}
      >
        <div className="text-3xl">{value}</div>
        <div className="text-lg mt-2">{label}</div>
        {sub && <div className="text-xs text-gray-300 mt-1">{sub}</div>}
        {icon}
      </div>
    </div>
  );
}

function SummaryDashboard() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [totalSubProducts, setTotalSubProducts] = useState(0);
  const [byDate, setByDate] = useState<SummaryByDate>({});
  const [dayEntries, setDayEntries] = useState<Record<string, SummaryEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);

  /* [old]
  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i--) out.push(toKey(addDays(selectedDate, -i)));
    return out;
  }, [selectedDate]);
  */
  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i--) out.push(toKey(addDays(today, -i)));
    return out;
  }, [today]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodRes, sumRes] = await Promise.all([
          fetch(`/api/getnewproductname`, { cache: "no-store" }),
          fetch(`/api/getsummary?from=${dates[0]}&to=${dates[dates.length - 1]}`),
        ]);
        if (!prodRes.ok) throw new Error(`getnewproductname: ${prodRes.status}`);
        if (!sumRes.ok) throw new Error(`getsummary: ${sumRes.status}`);

        const prodJson = await prodRes.json();
        const sumJson = (await sumRes.json()) as SummaryByDate;
        if (cancelled) return;

        setTotalSubProducts(
          (prodJson.products ?? []).reduce(
            (n: number, p: any) => n + (Array.isArray(p.subProduct) ? p.subProduct.length : 0),
            0
          )
        );
        setByDate(sumJson);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [dates]);

  useEffect(() => {
    let cancelled = false;

    const loadDay = async () => {
      try {
        const res = await fetch(`/api/getsummary?date=${toKey(selectedDate)}`);
        if (!res.ok) throw new Error(`getsummary: ${res.status}`);
        const json = (await res.json()) as Record<string, SummaryEntry>;
        if (!cancelled) setDayEntries(json ?? {});
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? String(e));
      }
    };

    loadDay();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const stats = useMemo(() => {
    // [old] const day = byDate[toKey(selectedDate)] ?? {};
    const day = dayEntries;
    let passAll = 0;
    let notPass = 0;

    for (const entry of Object.values(day)) {
      if (!hasTestResult(entry)) continue;
      if (isAllPass(entry)) passAll += 1;
      else notPass += 1;
    }

    const reported = passAll + notPass;
    return {
      total: totalSubProducts,
      reported,
      noData: Math.max(0, totalSubProducts - reported),
      passAll,
      notPass,
    };
  // [old] }, [byDate, selectedDate, totalSubProducts]);
  }, [dayEntries, totalSubProducts]);

  const dailyCounts = useMemo(
    () => dates.map((d) => Object.values(byDate[d] ?? {}).filter(hasTestResult).length),
    [dates, byDate]
  );

  const legendRows = [
    { label: "Pass ทั้งหมด", value: stats.passAll, color: COLOR_PASS },
    { label: "มี Fail / Error", value: stats.notPass, color: COLOR_NOTPASS },
    // [old] { label: "ไม่มีผลวันนี้", value: stats.noData, color: COLOR_NODATA },
    { label: "ไม่มีผลในวันที่เลือก", value: stats.noData, color: COLOR_NODATA },
  ];

  const donutData = {
    labels: legendRows.map((r) => r.label),
    datasets: [
      {
        label: "subproduct",
        data: legendRows.map((r) => r.value),
        backgroundColor: legendRows.map((r) => r.color),
        borderColor: SURFACE,
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const value = ctx.parsed as number;
            // [old] const pct = stats.total > 0 ? Math.round((value / stats.total) * 100) : 0;
            // [old] return ` ${ctx.label}: ${value} (${pct}%)`;
            return ` ${ctx.label}: ${value} (${formatPercent(value, stats.total)})`;
          },
        },
      },
    },
  };

  const lineData = {
    labels: dates.map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`),
    datasets: [
      {
        label: "subproduct ที่ส่งข้อมูล",
        data: dailyCounts,
        borderColor: COLOR_LINE,
        backgroundColor: "rgba(63, 154, 224, 0.14)",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: COLOR_LINE,
        pointBorderColor: SURFACE,
        pointBorderWidth: 2,
        // [old] tension: 0.35,
        tension: 0,
        fill: true,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    /* [old]
    onClick: (_e: any, elements: any[]) => {
      if (!elements?.length) return;
      const key = dates[elements[0].index];
      if (key) setSelectedDate(new Date(`${key}T00:00:00`));
    },
    */
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${ctx.parsed.y} subproduct`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9aa5b5" },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(255, 255, 255, 0.07)" },
        ticks: { color: "#9aa5b5", precision: 0 },
      },
    },
  };

  return (
    <div className="p-6 font-nunito">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">ภาพรวมการทดสอบ</h1>
          <p className="mt-1 text-sm text-gray-300">
            {selectedDate.toLocaleDateString("en-GB")} &nbsp;|&nbsp; ส่งผลเข้ามา{" "}
            {stats.reported} จาก {stats.total} subproduct
          </p>
        </div>

        <div className="flex items-center">
          <label className="mr-2">Select Date : </label>
          <div className="relative inline-block cursor-pointer">
            <svg
              className="absolute left-2 top-1/2 z-10 h-5 w-5 -translate-y-1/2 pointer-events-none text-gray-500"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2.5" />
              <path d="M16 3v4M8 3v4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => date && setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              maxDate={new Date()}
              className="relative z-0 w-48 rounded-md border border-b-gray-300 bg-white p-2 pl-9 text-center text-black focus:outline-none"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#e05252]/60 bg-[#e05252]/10 p-4 text-[#f9b0b0]">
          โหลดข้อมูลไม่สำเร็จ: {error}
        </div>
      ) : loading ? (
        <LoadingState variant="overview" label="Loading overview..." />
      ) : (
        <>
          {/* [old] <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"> */}
          {/* [old]   <StatCard label="Total product" value={stats.total} accent="#cbd5e1" icon={IconTotal} /> */}
          {/* [old]   <StatCard label="ไม่มีผลในวันนี้" value={stats.noData} accent={COLOR_NODATA} icon={IconNoData} /> */}
          {/* [old]   <StatCard label="ไม่มีผลในวันที่เลือก" value={stats.noData} accent={COLOR_NODATA} icon={IconNoData} /> */}
          {/* [old]   <StatCard label="Pass ทั้งหมด" value={stats.passAll} accent={COLOR_PASS} icon={IconPass} /> */}
          {/* [old]   <StatCard label="มี Fail / Error" value={stats.notPass} accent={COLOR_NOTPASS} icon={IconNotPass} /> */}
          {/* [old] </div> */}
          <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4 font-bold">
            <StatCard
              label="Total product"
              value={stats.total}
              borderClass="bg-gray-400"
              hoverClass="hover:bg-gray-400"
            />
            <StatCard
              label="ไม่มีผล"
              value={stats.noData}
              sub={`Represents ${formatPercent(stats.noData, stats.total)} of the total`}
              borderClass="bg-[#a8b4c4]"
              hoverClass="hover:bg-[#a8b4c4]"
              icon={
                <CardIcon color={COLOR_NODATA}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                </CardIcon>
              }
            />
            <StatCard
              label="Pass"
              value={stats.passAll}
              sub={`Represents ${formatPercent(stats.passAll, stats.total)} of the total`}
              borderClass="bg-[#66c552]"
              hoverClass="hover:bg-[#66c552]"
              icon={
                <CardIcon color={COLOR_PASS}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M18 8.5L10.5 17l-5-5" />
                </CardIcon>
              }
            />
            <StatCard
              label="Fail / Error"
              value={stats.notPass}
              sub={`Represents ${formatPercent(stats.notPass, stats.total)} of the total`}
              borderClass="bg-[#e05252]"
              hoverClass="hover:bg-[#e05252]"
              icon={
                <CardIcon color={COLOR_NOTPASS}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M18 6L6 18M6 6l12 12" />
                </CardIcon>
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-gray-600 bg-[#2f3a4a] p-5 lg:col-span-1">
              <h2 className="text-lg font-bold">สัดส่วนของวันที่เลือก</h2>
              <p className="mt-1 text-sm text-gray-300">รวมทุก subproduct ที่ลงทะเบียนไว้</p>

              <div className="relative mx-auto mt-5 h-64 w-64">
                <Doughnut data={donutData} options={donutOptions} />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="text-3xl font-bold text-white">{stats.total}</div>
                  <div className="text-sm text-gray-300">subproduct</div>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {legendRows.map((row) => {
                  // [old] const pct = stats.total > 0 ? Math.round((row.value / stats.total) * 100) : 0;
                  const pct = formatPercent(row.value, stats.total);
                  return (
                    <li key={row.label} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        {row.label}
                      </span>
                      <span className="text-gray-300">
                        {/* [old] <b className="text-white">{row.value}</b> &nbsp;{pct}% */}
                        <b className="text-white">{row.value}</b> &nbsp;{pct}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-xl border border-gray-600 bg-[#2f3a4a] p-5 lg:col-span-2">
              <h2 className="text-lg font-bold">subproduct ที่ส่งข้อมูล</h2>
              {/* [old] <p className="mt-1 text-sm text-gray-300">ย้อนหลัง {RANGE_DAYS} วัน &mdash; คลิกที่จุดเพื่อดูวันนั้น</p> */}
              <p className="mt-1 text-sm text-gray-300">
                {RANGE_DAYS} วันล่าสุด ({dates[0].slice(8, 10)}/{dates[0].slice(5, 7)} &ndash;{" "}
                {dates[dates.length - 1].slice(8, 10)}/{dates[dates.length - 1].slice(5, 7)})
              </p>

              <div className="mt-5 h-80">
                <Line data={lineData} options={lineOptions} />
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default SummaryDashboard;

// [old] import React, { useState, useEffect, useMemo } from "react";
// [old] import Swal from "sweetalert2";
// [old] import { Doughnut } from "react-chartjs-2";
// [old] import {
// [old]   Chart as ChartJS,
// [old]   CategoryScale,
// [old]   LinearScale,
// [old]   ArcElement,
// [old]   BarElement,
// [old]   Title,
// [old]   Tooltip,
// [old]   Legend,
// [old] } from "chart.js";
// [old] import DatePicker from "react-datepicker";
// [old] import "react-datepicker/dist/react-datepicker.css";
// [old] import { useRouter } from "next/router";
// [old]
// [old] ChartJS.register(
// [old]   CategoryScale,
// [old]   LinearScale,
// [old]   ArcElement,
// [old]   BarElement,
// [old]   Title,
// [old]   Tooltip,
// [old]   Legend
// [old] );
// [old]
// [old] interface NameTest {
// [old]   name: string;
// [old]   pass: number;
// [old]   fail: number;
// [old]   error: number;
// [old]   time: string;
// [old]   mainproduct: string;
// [old]   detailfail: object[];
// [old]   detailerror: object[];
// [old] }
// [old]
// [old] function SummaryDashboard() {
// [old]   const [error, setError] = useState<string | null>(null);
// [old]   const [sumresult, setSumresult] = useState<
// [old]     { pass: number; fail: number; error: number; name: string }[]
// [old]   >([]);
// [old]   const [startDate, setStartDate] = useState<Date | null>(new Date());
// [old]   const [loading, setLoading] = useState<boolean>(false);
// [old]   const [filter, setFilter] = useState<"all" | "fail" | "error">("all");
// [old]   const router = useRouter();
// [old]
// [old]   const handleProductClick = (product: NameTest) => {
// [old]     router.push(`/${product.mainproduct}/${product.name}`);
// [old]   };
// [old]
// [old]   useEffect(() => {
// [old]     let isMounted = true; // Flag to prevent state updates if component unmounts
// [old]
// [old]     const fetchProduct = async () => {
// [old]       if (loading) return; // Prevent multiple simultaneous calls
// [old]
// [old]       try {
// [old]         if (!startDate) {
// [old]           throw new Error("Start date is not selected");
// [old]         }
// [old]
// [old]         setLoading(true);
// [old]         setError(null);
// [old]         const response = await fetch(
// [old]           `/api/getsummary?date=${startDate.toISOString().split("T")[0]}`
// [old]         );
// [old]
// [old]         if (!response.ok) {
// [old]           throw new Error("Network response was not ok");
// [old]         }
// [old]         const data = await response.json();
// [old]
// [old]         // getsummary keys entries by "<mainProduct>::<subProduct>" (one
// [old]         // collection can hold results for several main products), so take the
// [old]         // display name from the entry itself rather than from the key.
// [old]         let finaldata: { key: string; value: any }[] = [];
// [old]         Object.keys(data).forEach(function (key) {
// [old]           const value = data[key];
// [old]           if (value) {
// [old]             finaldata.push({ key: value.subproduct ?? key, value });
// [old]           }
// [old]         });
// [old]
// [old]         let sumresult: {
// [old]           pass: number;
// [old]           fail: number;
// [old]           error: number;
// [old]           name: string;
// [old]           mainproduct: string;
// [old]         }[] = [];
// [old]         if (finaldata.length === 0) {
// [old]           sumresult.push({
// [old]             pass: 0,
// [old]             fail: 0,
// [old]             error: 0,
// [old]             name: "nodata",
// [old]             mainproduct: "",
// [old]           });
// [old]         } else {
// [old]           finaldata.forEach((item) => {
// [old]             const sum = (item?.value.nametest ?? []).reduce(
// [old]               (
// [old]                 acc: {
// [old]                   pass: number;
// [old]                   fail: number;
// [old]                   error: number;
// [old]                   name: string;
// [old]                   mainproduct: string;
// [old]                 },
// [old]                 curr: NameTest
// [old]               ) => ({
// [old]                 pass: acc.pass + curr.pass,
// [old]                 fail: acc.fail + curr.fail,
// [old]                 error: acc.error + curr.error,
// [old]                 name: item.key,
// [old]                 mainproduct: item.value.mainproduct || "",
// [old]               }),
// [old]               {
// [old]                 pass: 0,
// [old]                 fail: 0,
// [old]                 error: 0,
// [old]                 name: item.key,
// [old]                 mainproduct: item.value.mainproduct || "",
// [old]               }
// [old]             );
// [old]             sumresult.push(sum);
// [old]           });
// [old]           sumresult.sort((a, b) => a.name.localeCompare(b.name));
// [old]         }
// [old]
// [old]         if (!isMounted) return;
// [old]
// [old]         setSumresult(sumresult);
// [old]       } catch (error) {
// [old]         if (!isMounted) return; // Don't update state if component unmounted
// [old]
// [old]         if (error instanceof Error) {
// [old]           setError(error.message);
// [old]         } else {
// [old]           setError(String(error));
// [old]         }
// [old]         Swal.fire({
// [old]           icon: "error",
// [old]           title: "Oops...",
// [old]           text: (error as Error).message,
// [old]         });
// [old]       } finally {
// [old]         if (isMounted) {
// [old]           setLoading(false);
// [old]         }
// [old]       }
// [old]     };
// [old]
// [old]     fetchProduct();
// [old]
// [old]     // Cleanup function
// [old]     return () => {
// [old]       isMounted = false;
// [old]     };
// [old]   }, [startDate]); // Remove startDate dependency if causing issues
// [old]
// [old]   const doughnutOptions = {
// [old]     responsive: true,
// [old]     onClick: (event: any, elements: any) => {
// [old]       if (elements && elements.length > 0) {
// [old]         // Get the product name from the chart context
// [old]         const chart = event.chart;
// [old]         const productName = chart.canvas.getAttribute("data-product-name");
// [old]         if (productName) {
// [old]           handleProductClick(productName);
// [old]         }
// [old]       }
// [old]     },
// [old]     plugins: {
// [old]       legend: {
// [old]         position: "bottom" as const,
// [old]         labels: {
// [old]           color: "#b9bab8", // Change this to your desired color
// [old]         },
// [old]       },
// [old]       title: {
// [old]         display: true,
// [old]         color: "#b9bab8", // Change this to your desired color
// [old]       },
// [old]     },
// [old]   };
// [old]
// [old]   const filteredSumresult = useMemo(() => sumresult.filter((item: any) => {
// [old]     if (filter === "all") return true;
// [old]     if (filter === "fail") return item.fail > 0;
// [old]     if (filter === "error") return item.error > 0;
// [old]     return true;
// [old]   }), [sumresult, filter]);
// [old]
// [old]   return (
// [old]     <>
// [old]       <div className="p-4">
// [old]         <div className="flex items-center justify-between mb-4">
// [old]           <div className="flex justify-center text-white font-bold text-l">
// [old]             <div
// [old]               className={`w-[5vw] p-2 border rounded-l-lg text-center ${
// [old]                 filter === "all" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
// [old]               } cursor-pointer hover:opacity-80 transition-opacity`}
// [old]               onClick={() => setFilter("all")}
// [old]             >
// [old]               All
// [old]             </div>
// [old]             <div
// [old]               className={`w-[5vw] p-2 border text-center ${
// [old]                 filter === "fail" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
// [old]               } cursor-pointer hover:opacity-80 transition-opacity`}
// [old]               onClick={() => setFilter("fail")}
// [old]             >
// [old]               Fail
// [old]             </div>
// [old]             <div
// [old]               className={`w-[5vw] p-2 border rounded-r-lg text-center ${
// [old]                 filter === "error" ? "bg-gray-500" : "bg-gray-700 text-gray-200"
// [old]               } cursor-pointer hover:opacity-80 transition-opacity`}
// [old]               onClick={() => setFilter("error")}
// [old]             >
// [old]               Error
// [old]             </div>
// [old]           </div>
// [old]           <div>
// [old]             <label className="mr-2">Select Date : </label>
// [old]             {/* DatePicker with inline calendar icon */}
// [old]             <div className="relative inline-block cursor-pointer">
// [old]               <svg
// [old]                 className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none h-5 w-5 z-10"
// [old]                 viewBox="0 0 24 24"
// [old]                 fill="none"
// [old]                 xmlns="http://www.w3.org/2000/svg"
// [old]                 aria-hidden="true"
// [old]               >
// [old]                 <rect
// [old]                   x="3"
// [old]                   y="5"
// [old]                   width="18"
// [old]                   height="16"
// [old]                   rx="2"
// [old]                   stroke="currentColor"
// [old]                   strokeWidth="2.5"
// [old]                 />
// [old]                 <path
// [old]                   d="M16 3v4M8 3v4"
// [old]                   stroke="currentColor"
// [old]                   strokeWidth="2.5"
// [old]                   strokeLinecap="round"
// [old]                 />
// [old]               </svg>
// [old]               <DatePicker
// [old]                 selected={startDate}
// [old]                 onChange={(date) => {
// [old]                   setStartDate(date);
// [old]                 }}
// [old]                 dateFormat="dd/MM/yyyy"
// [old]                 maxDate={new Date()}
// [old]                 className="w-48 text-center border border-b-gray-300 rounded-md pl-9 p-2 bg-white text-black focus:outline-none focus:ring-none relative z-0"
// [old]               />
// [old]             </div>
// [old]           </div>
// [old]         </div>
// [old]
// [old]         <div className="grid grid-cols-3 gap-2">
// [old]           {sumresult.length === 1 && sumresult[0].name === "nodata" ? (
// [old]             <div className="col-span-3 flex flex-col items-center justify-center h-96">
// [old]               <p className="font-bold text-2xl text-white">Data not found 🤩</p>
// [old]             </div>
// [old]           ) : (
// [old]             (() => {
// [old]               if (filteredSumresult.length === 0) {
// [old]                 return (
// [old]                   <div className="col-span-3 flex flex-col items-center justify-center h-96">
// [old]                     <p className="font-bold text-2xl text-white">No Data 🤩</p>
// [old]                   </div>
// [old]                 );
// [old]               }
// [old]
// [old]               return filteredSumresult.map((test: any, index: number) => {
// [old]                 const doughnutChartData = {
// [old]                   labels: ["Pass", "Fail", "Error"],
// [old]                   datasets: [
// [old]                     {
// [old]                       label: "Test Results",
// [old]                       data: [test.pass, test.fail, test.error],
// [old]                       backgroundColor: ["#66c552", "#f77575", "#f0f06c"],
// [old]                     },
// [old]                   ],
// [old]                 };
// [old]
// [old]                 const chartOptions = {
// [old]                   ...doughnutOptions,
// [old]                   onClick: (event: any, elements: any) => {
// [old]                     handleProductClick(test);
// [old]                   },
// [old]                 };
// [old]
// [old]                 return (
// [old]                   <div
// [old]                     key={index}
// [old]                     className="w-[80%] h-[80%] flex flex-col items-center justify-center ml-[2vw] mb-6"
// [old]                   >
// [old]                     <p className="font-bold text-[1.5vw]">{test.name}</p>
// [old]                     <div
// [old]                       className="cursor-pointer hover:opacity-80 transition-opacity w-[20vw] h-[20vw]"
// [old]                       onClick={() => handleProductClick(test)}
// [old]                     >
// [old]                       {/* Styled doughnut similar to Dashboard.tsx: dark circular background, thicker ring, center overlay */}
// [old]                       <div className="relative w-full h-full flex items-center justify-center bg-[#364153] rounded-full p-4 mt-4">
// [old]                         <div className="absolute inset-0 flex items-center justify-center hover:scale-105 transition-transform duration-200">
// [old]                           <Doughnut
// [old]                             data={doughnutChartData}
// [old]                             options={{
// [old]                               ...chartOptions,
// [old]                               maintainAspectRatio: false,
// [old]                               cutout: "70%",
// [old]                               plugins: {
// [old]                                 ...chartOptions.plugins,
// [old]                                 legend: { display: false },
// [old]                                 title: { display: false },
// [old]                               },
// [old]                             }}
// [old]                           />
// [old]                         </div>
// [old]
// [old]                         <div className="absolute text-center text-white pointer-events-none">
// [old]                           <div className="text-[1vw] mb-2">Test Result</div>
// [old]                           <div className="text-[2vw] font-bold">
// [old]                             {(() => {
// [old]                               const total =
// [old]                                 (test.pass || 0) +
// [old]                                 (test.fail || 0) +
// [old]                                 (test.error || 0);
// [old]                               const pct =
// [old]                                 total > 0
// [old]                                   ? Math.round(((test.pass || 0) / total) * 100)
// [old]                                   : 0;
// [old]                               return `${pct}%`;
// [old]                             })()}
// [old]                           </div>
// [old]                           <div className="text-[1vw] mt-2">Pass</div>
// [old]                         </div>
// [old]                       </div>
// [old]                     </div>
// [old]                   </div>
// [old]                 );
// [old]               });
// [old]             })()
// [old]           )}
// [old]         </div>
// [old]       </div>
// [old]     </>
// [old]   );
// [old] }
// [old]
// [old] export default SummaryDashboard;
// [old]
