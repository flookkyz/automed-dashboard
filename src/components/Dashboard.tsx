import React, { useState, useEffect } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, ArcElement, BarElement, Title, Tooltip, Legend, Colors } from 'chart.js';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Title, Tooltip, Legend);

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

function Dashboard({ products }: DashboardProps) {
    const [detailPopup, setDetailPopup] = useState(false);
    const [headerDetail, setHeaderDetail] = useState("");
    const [nameDetail, setNameDetail] = useState("");
    const [detailTest, setDetailTest] = useState<any[]>([]);
    const [product, setProduct] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<Date | null>(new Date());
    const [data, setData] = useState<any[]>([]);

    const sum = product?.nametest?.reduce((acc: { pass: number, fail: number, error: number }, curr: NameTest) => ({
        pass: acc.pass + curr.pass,
        fail: acc.fail + curr.fail,
        error: acc.error + curr.error,
    }), { pass: 0, fail: 0, error: 0 });

    const onDetail = (action: String, data: any, name: string) => {
        setHeaderDetail(action === "fail" ? "Fail" : "Error");
        setNameDetail(name);
        setDetailPopup(true);
        setDetailTest(data);
    };

    useEffect(() => {
        console.log("startgetdate", products);
        const fetchProducts = async () => {
            setData([]);
            setStartDate(null);
            try {
                const response = await fetch(`/api/getdatefromtest?nameproduct=${products}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                const lastItem = data[data.length - 1];
                setStartDate(new Date(lastItem));
                setData(data);
            } catch (error: any) {
                console.log(error.message);

            }
        };

        fetchProducts();
    }, [products]);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!products) return;
            try {
                if (!startDate) {
                    throw new Error('Start date is not selected');
                }
                const response = await fetch(`/api/gettestdata?nameproduct=${products}&date=${startDate.toISOString().split('T')[0]}`);
                const data = await response.json();

                setProduct(data);
            } catch (error) {
                if (error instanceof Error) {
                    setError(error.message);
                } else {
                    setError(String(error));
                }
            }
        };
        fetchProduct();
    }, [products, startDate]);


    const doughnutChartData = {
        labels: ['Pass', 'Fail', 'Error'],
        datasets: [
            {
                label: 'Test Results',
                data: [sum?.pass, sum?.fail, sum?.error],
                backgroundColor: ['#66c552', '#f77575', '#f0f06c'],
            },
        ],
    };

    const barChartData = {
        labels: product?.nametest?.map((data: NameTest) => data.name),
        datasets: [
            {
                label: 'Pass',
                data: product?.nametest?.map((data: NameTest) => data.pass),
                backgroundColor: '#66c552',
            },
            {
                label: 'Fail',
                data: product?.nametest?.map((data: NameTest) => data.fail),
                backgroundColor: '#f77575',
            },
            {
                label: 'Error',
                data: product?.nametest?.map((data: NameTest) => data.error),
                backgroundColor: '#f0f06c',
            },
        ],
    };

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
            },
            title: {
                display: true,
            },
        },
    };

    const barOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
            },
            title: {
                display: true,
            },
        },
        scales: {
            x: {
                stacked: true,
            },
            y: {
                stacked: true,
            },
        },
    };

    return (
        <>

            <div className="p-4">
                <div className='flex justify-between items-center'>
                    <p className='text-xl font-bold'>{products ? products : "Welcome To Dashbaord"}</p>
                    <div className='flex items-center justify-end'>
                        <label className='mr-2'>Select Date : </label>
                        <DatePicker
                            selected={startDate}
                            onChange={(date) => {
                                setStartDate(date);
                            }}
                            includeDates={data}
                            placeholderText="This only includes today and tomorrow"
                            className="border border-b-gray-300 rounded-md p-2 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:border-gray-400"
                        />
                    </div>
                </div>
                <div className="w-full h-32 mt-6 px-36 flex flex-row items-center justify-between font-bold">
                    <div className="w-60 bg-gray-200 flex flex-col items-start justify-center h-full rounded-xl p-4 text-gray-800">
                        <div className="text-xl">Total</div>
                        <div className="text-3xl">{sum?.pass + sum?.fail + sum?.error}</div>
                    </div>
                    <div className="w-60 bg-green-200 flex flex-col items-start justify-center h-full rounded-xl p-4 text-green-800">
                        <div className="text-xl">Pass</div>
                        <div className="text-3xl">{sum?.pass}</div>
                    </div>
                    <div className="w-60 bg-red-200 flex flex-col items-start justify-center h-full rounded-xl p-4 text-red-800">
                        <div className="text-xl">Fail</div>
                        <div className="text-3xl">{sum?.fail}</div>
                    </div>
                    <div className="w-60 bg-yellow-200 flex flex-col items-start justify-center h-full rounded-xl p-4 text-yellow-800">
                        <div className="text-xl">Error</div>
                        <div className="text-3xl">{sum?.error}</div>
                    </div>
                </div>
            </div>
            <div className="px-4 py-8 flex justify-center">
                <div className="flex w-3/4 h-96 items-center justify-between">
                    <div className="w-1/2 h-full flex flex-col items-center justify-center">
                        <p>Test Results Distribution</p>
                        <Doughnut data={doughnutChartData} options={doughnutOptions} />
                    </div>
                    <div className="w-3/4 h-full ml-24 flex flex-col items-center justify-center">
                        <p>Test Results Overview</p>
                        <Bar data={barChartData} options={barOptions} />
                    </div>
                </div>
            </div>
            <div className='p-8'>
                <table className="w-full mt-6 font-bold">
                    <thead>
                        <tr className="bg-gray-800 text-white">
                            <th className="py-2">Name Test</th>
                            <th className="py-2">Pass</th>
                            <th className="py-2">Fail</th>
                            <th className="py-2">Error</th>
                            <th className="py-2">Total</th>
                            <th className="py-2">Time(s)</th>
                            <th className="py-2">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {product?.nametest?.map((data: NameTest, index: number) => (
                            <tr key={index} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-500 dark:hover:bg-gray-600">
                                <td className="py-2 px-4">{data.name}</td>
                                <td className="py-2 text-center">{data.pass}</td>
                                {data.fail > 0 ? (<td className="py-2 text-center bg-[#f77575] cursor-pointer" onClick={() => onDetail("fail", data.detailfail, data.name)}> {data.fail}</td>)
                                    :
                                    (<td className="py-2 text-center">{data.fail}</td>)}
                                {data.error > 0 ? (<td className="py-2 text-center bg-[#f0f06c] cursor-pointer" onClick={() => onDetail("error", data.detailerror, data.name)}>{data.error}</td>)
                                    :
                                    (<td className="py-2 text-center">{data.error}</td>)}
                                <td className="py-2 text-center">{data.pass + data.fail + data.error}</td>
                                <td className="py-2 text-center">{data.time}</td>
                                <td className="py-2 text-center">{product.date}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >
            {
                detailPopup && (
                    <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white dark:bg-gray-500 dark:text-white w-2/3 h-4/6 rounded-xl p-8 flex flex-col items-center justify-center dark:text-black">
                            <div className="text-xl text-center font-bold">{nameDetail}</div>
                            <div className="text-xl text-center font-bold">{headerDetail} Detail</div>
                            <div className='w-full mt-6 h-96 '>
                                <table className="w-full">
                                    <thead>
                                        {detailTest[0].name ? <tr className="bg-gray-800 text-white">
                                            <th className="py-2 px-4 w-1/2">name test</th>
                                            <th className="py-2 px-4 ">detail</th>
                                        </tr> : <tr className="bg-gray-800 text-white">
                                            <th className="py-2 px-4">detail</th>
                                        </tr>}

                                    </thead>
                                </table>
                                <div className="overflow-y-auto h-80">
                                    <table className="w-full">
                                        <tbody>
                                            {Array.isArray(detailTest) && detailTest.map((item: any, index: number) => (
                                                <>
                                                    {item.name ? <tr key={index} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white">
                                                        <td className="py-2 px-4 w-1/2">{item.name.replace("Place Order Tests ›", "")}</td>
                                                        <td className="py-2 px-4 border-l border-black">{item.error.split('Call log')[0]}<br />{item.error.split('Call log')[1] ? `Call log ${item.error.split('Call log')[1]}` : null}</td>
                                                    </tr> : <tr key={index} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white">
                                                        <td className="py-2 px-4">{item}</td>
                                                    </tr>}
                                                </>

                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="flex justify-center mt-6 flex flex-row">
                                <button className="bg-green-500 text-white px-4 py-2 rounded-md" onClick={() => setDetailPopup(false)}>Close</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}

export default Dashboard;