import React from "react";
import LoadingState from "./LoadingState";
import { Product, subNames } from "../lib/products";

// Side panel listing what is currently registered, shown next to the add and
// delete forms so the current state is visible while filling them in.

type ProductListPanelProps = {
  products: Product[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export default function ProductListPanel({
  products,
  loading,
  error,
  onRefresh,
}: ProductListPanelProps) {
  return (
    <aside className="bg-[#2f3a4a] rounded-lg p-6 border border-gray-600">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-lg">ที่มีอยู่แล้ว</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="text-sm rounded px-3 py-1 bg-gray-600 hover:bg-gray-500 transition-colors"
        >
          รีเฟรช
        </button>
      </div>

      {loading ? (
        <LoadingState variant="simple" label="Loading products..." />
      ) : error ? (
        <div className="text-red-400">Error: {error}</div>
      ) : products.length === 0 ? (
        <div className="text-gray-400">ยังไม่มี product</div>
      ) : (
        <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {products.map((p) => {
            const subs = subNames(p);
            return (
              <li key={p.mainProduct}>
                <div className="font-semibold">{p.mainProduct}</div>
                <div className="text-sm text-gray-300 pl-3">
                  {subs.length === 0 ? "-" : subs.join(", ")}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
