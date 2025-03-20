import React from 'react';
import { useRouter } from 'next/router'
import Navbar from '../components/navbar';
import Dashboard from '../components/Dashboard';

const DataPage: React.FC = () => {
    const router = useRouter()
    return (
        <>
            <div className='flex flex-start'><Navbar /></div>
            <div className='ml-64'>
                {/* <h1>Data Page</h1>
                <p>Welcome to the data page!</p>
                <p>Post: {router.query.slug}</p> */}
                <Dashboard products={String(router.query.slug)} />
            </div>

        </>
    );
};

export default DataPage;