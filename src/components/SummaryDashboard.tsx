import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, ArcElement, BarElement, Title, Tooltip, Legend } from 'chart.js';

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

function SummaryDashboard({ products, date }: DashboardProps) {
    const [error, setError] = useState<string | null>(null);
    const [sumresult, setSumresult] = useState<{ pass: number; fail: number; error: number, name: string }[]>([]);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await fetch(`/api/getsummary?date=${date.toISOString().split('T')[0]}`);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                let finaldata: { key: string; value: any }[] = [];
                Object.keys(data).forEach(function (key, index) {
                    let newdata = { key: key, value: data[key] };
                    if (newdata.value) {
                        finaldata.push(newdata);
                    }
                })
                let sumresult = [];
                finaldata.forEach((item) => {
                    console.log('item', item.key);
                    const sum = item?.value.nametest.reduce((acc: { pass: number, fail: number, error: number }, curr: NameTest) => ({
                        pass: acc.pass + curr.pass,
                        fail: acc.fail + curr.fail,
                        error: acc.error + curr.error,
                        name: item.key
                    }), { pass: 0, fail: 0, error: 0, name: "" });
                    sumresult.push(sum);
                    sumresult.sort((a, b) => a.name.localeCompare(b.name));
                    setSumresult(sumresult);
                })
            } catch (error) {
                if (error instanceof Error) {
                    setError(error.message);
                } else {
                    setError(String(error));
                }
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: (error as Error).message,
                });
            }
        };
        fetchProduct();
    }, [products, date]);

    const doughnutOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    color: '#b9bab8', // Change this to your desired color
                },
            },
            title: {
                display: true,
                color: '#b9bab8', // Change this to your desired color
            },
        },
    };

    return (
        <>
            <div className='p-4'>
                <div className='grid grid-cols-3 gap-4'>
                    {sumresult?.map((test: any, index: number) => {
                        console.log('testaaa', test);

                        const doughnutChartData = {
                            labels: ['Pass', 'Fail', 'Error'],
                            datasets: [
                                {
                                    label: 'Test Results',
                                    data: [test.pass, test.fail, test.error],
                                    backgroundColor: ['#66c552', '#f77575', '#f0f06c'],
                                },
                            ],
                        };
                        return (
                            <div key={index} className="w-5/6 h-96 p-4 flex flex-col items-center justify-center">
                                <p className='font-bold text-xl'>{test.name}</p>
                                <Doughnut data={doughnutChartData} options={doughnutOptions} />
                            </div>
                        );
                    })}
                </div>
            </div>

        </>
    );
}

export default SummaryDashboard;
