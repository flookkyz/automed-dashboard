import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import LoadingState from "../components/LoadingState";

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
                const response = await fetch('http://localhost:3001/api/getdatefromtest?nameproduct=VN_Webtrade');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
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
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-black">
            <div className="text-lg font-semibold text-gray-700 mb-4">Test</div>
            {loading ? (
                <LoadingState variant="fullscreen" label="Loading dates..." />
            ) : error ? (
                <div className="text-red-600 mb-2">Error: {error}</div>
            ) : null}
            <DatePicker
                selected={startDate}
                onChange={(date) => {
                    setStartDate(date), console.log("fff", date);
                }}
                includeDates={data}
                disabled={loading}
                placeholderText="This only includes today and tomorrow"
            />
        </div>
    );
}

export default testdate;
