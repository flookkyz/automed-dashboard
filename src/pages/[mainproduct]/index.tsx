import React from "react";
import { useRouter } from "next/router";
import MainProductDashboard from "../../components/MainProductDashboard";

const MainProductPage = () => {
  const router = useRouter();
  const { mainproduct = "" } = router.query;

  return (
    <>
      <div className="ml-64">
        <MainProductDashboard mainproduct={mainproduct.toString()} />
      </div>
    </>
  );
};

export default MainProductPage;
