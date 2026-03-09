import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoadingState from "../../components/LoadingState";

function testdate() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          "http://localhost:3001/api/getdatefromtest?nameproduct=VN_Webtrade"
        );
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        const data = await response.json();
        interface ApiResponse {
          array: string[];
        }
        let datadate: Date[] = [];
        (data as ApiResponse).array.forEach((element: string) => {
          datadate.push(new Date(element));
        });
        setData(datadate);
      } catch (error: any) {
        console.log(error.message);
        setError(error?.message ?? String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <div className="p-4">
      {loading ? (
        <LoadingState variant="fullscreen" label="Loading dates..." />
      ) : error ? (
        <div className="text-red-400">Error: {error}</div>
      ) : (
        <DatePicker selected={startDate} onChange={(d) => setStartDate(d)} includeDates={data} />
      )}
    </div>
  );
}

export default testdate;
