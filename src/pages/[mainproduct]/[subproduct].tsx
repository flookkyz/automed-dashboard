import React from "react";
import { useRouter } from "next/router";
import Dashboard from "../../components/Dashboard";

const DataPage = () => {
  const router = useRouter();
  const { mainproduct = "", subproduct = "" } = router.query;
  return (
    <>
      <div className="ml-64">
        <Dashboard
          mainproduct={mainproduct.toString()}
          subproduct={subproduct.toString()}
        />
      </div>
    </>
  );
};

export default DataPage;
