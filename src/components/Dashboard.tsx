import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, ArcElement, BarElement, Title, Tooltip, Legend, Colors } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, ArcElement, BarElement, Title, Tooltip, Legend);

interface DashboardProps {
    products: string;
    date: Date;
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

function Dashboard({ products, date }: DashboardProps) {
    const [deletePopup, setDeletePopup] = useState(false);
    const [detailPopup, setDetailPopup] = useState(false);
    const [deleteNameTest, setDeleteNameTest] = useState("");
    const [headerDetail, setHeaderDetail] = useState("");
    const [nameDetail, setNameDetail] = useState("");
    const [loading, setLoading] = useState(false);
    const [detailTest, setDetailTest] = useState<any[]>([]);
    const [product, setProduct] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const sum = product?.nametest?.reduce((acc: { pass: number, fail: number, error: number }, curr: NameTest) => ({
        pass: acc.pass + curr.pass,
        fail: acc.fail + curr.fail,
        error: acc.error + curr.error,
    }), { pass: 0, fail: 0, error: 0 });


    const onDeleted = (nameTest: string) => {
        setDeletePopup(true);
        setDeleteNameTest(nameTest);
    };

    const confirmDelete = () => {
        setDeletePopup(false);
        setDeleteNameTest("");
        Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: `Deleted ${deleteNameTest} Successfully`,
        });
    };

    const onDetail = (action: String, data: any, name: string) => {
        setHeaderDetail(action === "fail" ? "Fail" : "Error");
        setNameDetail(name);
        setDetailPopup(true);
        setDetailTest(data);
    };

    useEffect(() => {
        setLoading(true);
        const fetchProduct = async () => {
            try {
                const response = await fetch(`/api/gettestdata?nameproduct=${products}&date=${date.toISOString().split('T')[0]}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setProduct(data);
                setLoading(false);
            } catch (error) {
                if (error instanceof Error) {
                    setError(error.message);
                } else {
                    setError(String(error));
                }
                setLoading(false);
                // setDate(new Date());
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: (error as Error).message,
                });
            }
        };
        fetchProduct();
    }, [products, date]);


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
            {loading ? (
                <>
                    <div role="status" className='p-[30vh] flex items-center justify-center w-full'>
                        <svg aria-hidden="true" className="inline w-32 h-32 text-gray-200 animate-spin dark:text-gray-600 fill-gray-600 dark:fill-gray-300" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" />
                            <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill" />
                        </svg>
                        <span className="sr-only">Loading...</span>
                    </div></>)
                :
                (<>
                    <div className="p-4">
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
                    {deletePopup && (
                        <div className="fixed top-0 left-0 w-full h-full bg-gray-900 bg-opacity-50 flex items-center justify-center">
                            <div className="bg-white w-1/3 h-2/5 rounded-xl p-16 flex flex-col items-center justify-around">
                                <div className="text-3xl font-bold text-center">Are you sure to delete?</div>
                                <div className="text-xl text-center">{deleteNameTest}</div>
                                <div className="flex justify-center mt-6 flex flex-row">
                                    <button className="bg-green-500 text-white px-4 py-2 rounded-md" onClick={confirmDelete}>Yes</button>
                                    <button className="bg-red-500 text-white px-4 py-2 rounded-md ml-4" onClick={() => setDeletePopup(false)}>No</button>
                                </div>
                            </div>
                        </div>
                    )
                    }
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
                                                            {item.name ? <tr key={index} className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-black">
                                                                <td className="py-2 px-4 w-1/2">{item.name.replace("Place Order Tests ›", "")}</td>
                                                                <td className="py-2 px-4 border-l border-black">{item.error.split('Call log')[0]}<br />{item.error.split('Call log')[1] ? `Call log ${item.error.split('Call log')[1]}` : null}</td>
                                                            </tr> : <tr key={index} className="bg-gray-100 hover:bg-gray-200 dark:text-black">
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
                )
            }
        </>
    );
}

export default Dashboard;