import React from "react";
import { useRouter } from "next/router";
import MainProductDashboard from "../../components/MainProductDashboard";

export default function MainProductPage() {
  const router = useRouter();
  const mainproduct = typeof router.query.mainproduct === "string" ? router.query.mainproduct : "";

  return (
    <div className="ml-64">
      <MainProductDashboard mainproduct={mainproduct} />
    </div>
  );
}
