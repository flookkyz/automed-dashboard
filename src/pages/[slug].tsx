import React from "react";
import { useRouter } from "next/router";
import Navbar from "../components/navbar";
import Dashboard from "../components/Dashboard";

const DataPage = () => {
  const router = useRouter();
  return (
    <>
      <div className="flex flex-start">
        <Navbar />
      </div>
      <div className="ml-64">
        <Dashboard products={router.query.slug?.toString() ?? ""} />
      </div>
    </>
  );
};

export default DataPage;
