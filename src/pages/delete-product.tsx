import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AdminOnly from "../components/AdminOnly";
import Combobox from "../components/Combobox";
import LoadingState from "../components/LoadingState";
import ProductListPanel from "../components/ProductListPanel";
import { subNames, useProducts } from "../lib/products";

// Remove a registered product name, optionally together with its test results.

type DeleteMode = "sub" | "main";

function DeleteProductForm() {
  const router = useRouter();
  const { products, loading, error, mainProductNames, reload } = useProducts();

  const [mode, setMode] = useState<DeleteMode>("sub");
  const [mainInput, setMainInput] = useState("");
  const [subInput, setSubInput] = useState("");
  const [deleteTestData, setDeleteTestData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedMain = useMemo(
    () => products.find((p) => p.mainProduct === mainInput) ?? null,
    [products, mainInput]
  );
  const subOptions = useMemo(() => subNames(selectedMain), [selectedMain]);

  // Clear a subproduct that does not belong to the newly picked main product.
  useEffect(() => {
    setSubInput((current) => (current && subOptions.includes(current) ? current : ""));
  }, [subOptions]);

  const mainExists = Boolean(selectedMain);
  const subExists = subOptions.includes(subInput);
  const canDelete = !submitting && mainExists && (mode === "main" || subExists);

  // What the request will remove, used for the preview and the confirmation.
  const confirmWord = mode === "main" ? mainInput : subInput;
  const targetLabel = mode === "main" ? mainInput : `${mainInput} > ${subInput}`;
  const affectedSubs = mode === "main" ? subOptions : subExists ? [subInput] : [];

  const handleDelete = async () => {
    if (!canDelete) return;

    const confirm = await Swal.fire({
      icon: "warning",
      title: "ยืนยันการลบ",
      html: [
        `กำลังจะลบ <b>${targetLabel}</b>`,
        mode === "main"
          ? `รวม subproduct ${affectedSubs.length} ตัว: ${affectedSubs.join(", ") || "-"}`
          : "",
        deleteTestData
          ? `<span style="color:#f77575">ผลเทสต์เก่าของ ${mainInput} จะถูกลบถาวรด้วย</span>`
          : `<small>ผลเทสต์เก่ายังเก็บไว้ใน DB</small>`,
        "พิมพ์ชื่อด้านล่างเพื่อยืนยัน",
      ]
        .filter(Boolean)
        .join("<br/>"),
      input: "text",
      inputPlaceholder: confirmWord,
      inputValidator: (value) =>
        value === confirmWord ? null : `พิมพ์ "${confirmWord}" ให้ตรงเพื่อยืนยัน`,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#f77575",
    });

    if (!confirm.isConfirmed) return;

    setSubmitting(true);
    try {
      const resp = await fetch(`/api/deleteproductname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mainProduct: mainInput,
          subProduct: mode === "main" ? undefined : subInput,
          deleteTestData,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Request failed: ${resp.status}`);

      const lines = [
        data.removedMainProduct
          ? `ลบ main product ${data.mainProduct} แล้ว (${data.removedSubProducts.length} subproduct)`
          : `ลบ ${data.mainProduct} > ${data.subProduct} แล้ว`,
      ];
      if (data.deletedTestData) {
        lines.push(`ลบผลเทสต์ ${data.deletedDocuments} รายการ`);
        if (data.droppedCollections?.length) {
          lines.push(`ลบ collection: ${data.droppedCollections.join(", ")}`);
        }
        if (data.keptCollections?.length) {
          lines.push(
            `เก็บ collection ไว้: ${data.keptCollections
              .map((k: any) => `${k.name} (${k.reason})`)
              .join(", ")}`
          );
        }
      } else {
        lines.push("ผลเทสต์เก่ายังอยู่ใน DB");
      }

      await Swal.fire({ icon: "success", title: "ลบเรียบร้อย", html: lines.join("<br/>") });

      setSubInput("");
      if (mode === "main") setMainInput("");
      setDeleteTestData(false);
      await reload();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Oops...", text: err?.message ?? String(err) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ml-64 p-6 font-nunito">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">ลบ Product</h1>
        <p className="text-gray-300 mt-1">
          เอาชื่อ main product / sub product ออกจากเมนู และเลือกได้ว่าจะลบผลเทสต์เก่าด้วยหรือไม่
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#2f3a4a] rounded-lg p-6 border border-gray-600">
          <div className="mb-6">
            <label className="block font-semibold mb-2">ลบอะไร</label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "sub"}
                  onChange={() => setMode("sub")}
                />
                sub product ตัวเดียว
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "main"}
                  onChange={() => setMode("main")}
                />
                main product ทั้งอัน (พร้อม sub ทั้งหมด)
              </label>
            </div>
          </div>

          <div className="mb-6">
            <label className="block font-semibold mb-2">Main product</label>
            {loading ? (
              <LoadingState variant="simple" label="Loading products..." />
            ) : (
              <Combobox
                value={mainInput}
                onChange={setMainInput}
                options={mainProductNames}
                placeholder="พิมพ์เพื่อค้นหา หรือกด ▼ ดูทั้งหมด"
              />
            )}
            {mainInput && !mainExists && (
              <p className="text-red-400 text-sm mt-2">ไม่พบ main product ชื่อนี้</p>
            )}
          </div>

          {mode === "sub" && (
            <div className="mb-6">
              <label className="block font-semibold mb-2">Sub product</label>
              <Combobox
                value={subInput}
                onChange={setSubInput}
                options={subOptions}
                disabled={!mainExists}
                placeholder={
                  mainExists ? "พิมพ์เพื่อค้นหา หรือกด ▼ ดูทั้งหมด" : "เลือก main product ก่อน"
                }
                emptyText="main product นี้ยังไม่มี subproduct"
              />
              {subInput && !subExists && (
                <p className="text-red-400 text-sm mt-2">
                  ไม่พบ subproduct ชื่อนี้ใน {mainInput}
                </p>
              )}
            </div>
          )}

          <div className="mb-6 rounded border border-gray-600 bg-[#2b3545] p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={deleteTestData}
                onChange={(e) => setDeleteTestData(e.target.checked)}
              />
              <span>
                <span className="font-semibold">ลบผลเทสต์เก่าด้วย</span>
                <span className="block text-sm text-gray-300 mt-1">
                  ลบเฉพาะ document ที่เป็นของ main product นี้ ถ้า subproduct
                  ถูกแชร์กับ product อื่นอยู่ ข้อมูลของอีกฝั่งจะไม่ถูกแตะ
                  <br />
                  ถ้าไม่ติ๊ก ข้อมูลจะยังอยู่ใน DB และกลับมาเห็นได้ถ้าเพิ่มชื่อกลับเข้าไป
                </span>
              </span>
            </label>
          </div>

          {canDelete && (
            <div className="mb-6 rounded border border-[#f77575]/60 bg-[#f77575]/10 p-4 text-sm">
              <div className="font-semibold text-[#f9b0b0] mb-1">จะลบ:</div>
              <div>{targetLabel}</div>
              {mode === "main" && (
                <div className="text-gray-300 mt-1">
                  subproduct {affectedSubs.length} ตัว: {affectedSubs.join(", ") || "-"}
                </div>
              )}
              <div className="text-gray-300 mt-1">
                {deleteTestData ? "ลบผลเทสต์เก่าด้วย (ย้อนกลับไม่ได้)" : "เก็บผลเทสต์เก่าไว้"}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="rounded px-5 py-2 font-semibold bg-[#f77575] hover:bg-[#e15f5f] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "กำลังลบ..." : "ลบ"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded px-5 py-2 bg-gray-600 hover:bg-gray-500 transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>

        <ProductListPanel
          products={products}
          loading={loading}
          error={error}
          onRefresh={reload}
        />
      </div>
    </div>
  );
}

export default function DeleteProductPage() {
  return (
    <AdminOnly>
      <DeleteProductForm />
    </AdminOnly>
  );
}
