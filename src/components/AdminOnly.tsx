import React from "react";
import { useRouter } from "next/router";
import LoadingState from "./LoadingState";
import { isAdmin, useRole } from "../lib/role";

// Gate for the product management pages. The navbar already hides their entry
// points; this keeps the URL from being a way around that.
//
// The role comes from a cookie the visitor can edit, so this decides what the
// UI offers, not what the API allows.

export default function AdminOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const role = useRole();

  // null until the first client render, when the cookie becomes readable.
  if (role === null) {
    return (
      <div className="ml-64 p-6 font-nunito">
        <LoadingState variant="simple" label="Loading..." />
      </div>
    );
  }

  if (!isAdmin(role)) {
    return (
      <div className="ml-64 p-6 font-nunito">
        <h1 className="text-3xl font-bold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="text-gray-300 mt-2">
          หน้านี้เปิดให้เฉพาะผู้ใช้ที่มี role เป็น admin เท่านั้น
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 rounded px-5 py-2 bg-gray-600 hover:bg-gray-500 transition-colors"
        >
          กลับหน้าหลัก
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
