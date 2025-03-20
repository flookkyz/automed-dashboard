import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

function testdate() {
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
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

            }
        };

        fetchProducts();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 text-black">
            <div className="text-lg font-semibold text-gray-700 mb-4">Test</div>
            <DatePicker
                selected={startDate}
                onChange={(date) => {
                    setStartDate(date), console.log("fff", date);
                }}
                includeDates={data}
                placeholderText="This only includes today and tomorrow"
            />
        </div>
    );
}

export default testdate;
