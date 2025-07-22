import React from "react";
import Navbar from "../components/navbar";
import SummaryDashboard from "../components/SummaryDashboard";

const MainDashboard = () => {
  const onSelectProduct = (product: string) => {
    // This will be handled by the navbar component's routing
  };

  return (
    <>
      <div className="flex flex-start">
        <Navbar />
      </div>
      <div className="ml-64">
        <SummaryDashboard products="" onSelectProduct={onSelectProduct} />
      </div>
    </>
  );
};

export default MainDashboard;
