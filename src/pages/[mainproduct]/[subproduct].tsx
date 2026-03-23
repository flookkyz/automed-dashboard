import React from "react";
import { useRouter } from "next/router";
import Dashboard from "../../components/Dashboard";

const DataPage = () => {
  const router = useRouter();
  const { mainproduct = "", subproduct = "" } = router.query;
  return (
    <>
      <div className="ml-64">
        <div className="flex justify-end px-6 pt-6">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 rounded-md bg-gray-800 text-white hover:bg-gray-700 transition-colors"
            onClick={() => {
              const mp = mainproduct?.toString() ?? "";
              const sp = subproduct?.toString() ?? "";
              router.push({ pathname: "/sonar", query: { mainproduct: mp, subproduct: sp } }, undefined, {
                shallow: true,
              });
            }}
          >
            SonarQ
          </button>
        </div>
        <Dashboard
          mainproduct={mainproduct.toString()}
          subproduct={subproduct.toString()}
        />
      </div>
    </>
  );
};

export default DataPage;
