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
import { log } from "console";

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

function SummaryDashboard({ products }: DashboardProps) {
  const [error, setError] = useState<string | null>(null);
  const [sumresult, setSumresult] = useState<
    { pass: number; fail: number; error: number; name: string }[]
  >([]);
  const [startDate, setStartDate] = useState<Date | null>(new Date());

useEffect(() => {
    const fetchProduct = async () => {
        try {
            if (!startDate) {
                throw new Error("Start date is not selected");
            }
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

            let sumresult: { pass: number; fail: number; error: number; name: string }[] = [];
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
            setSumresult(sumresult);
            console.log("sumresult", sumresult);

        } catch (error) {
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
        }
    };
    fetchProduct();
}, [products, startDate]);

  const doughnutOptions = {
    responsive: true,
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
        <div className="flex items-center justify-end">
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
              return (
                <div
                  key={index}
                  className="w-[80%] h-96 p-4 flex flex-col items-center justify-center"
                >
                  <p className="font-bold text-xl">{test.name}</p>
                  <Doughnut data={doughnutChartData} options={doughnutOptions} />
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
