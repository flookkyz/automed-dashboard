import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import AdminOnly from "../components/AdminOnly";
import Combobox from "../components/Combobox";
import LoadingState from "../components/LoadingState";
import ProductListPanel from "../components/ProductListPanel";
import { findSimilar, subNames, useProducts } from "../lib/products";

// Register a main product / sub product name up front, before any test result
// has been pushed for it. Only the name is stored (in the product_name
// collection); the subproduct's own collection stays empty until a pipeline
// sends data.

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const NAME_HINT =
  "ใช้ได้เฉพาะ a-z A-Z 0-9 . _ - (1-64 ตัว) และต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข";

const INPUT_CLASS =
  "w-full rounded bg-[#2b3545] border border-gray-600 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-300";

function AddProductForm() {
  const router = useRouter();
  const { products, loading, error, mainProductNames, reload } = useProducts();

  const [mainMode, setMainMode] = useState<"existing" | "new">("new");
  const [mainInput, setMainInput] = useState("");
  const [subs, setSubs] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  const mainProduct = mainInput.trim();

  const existingSubs = useMemo(
    () => subNames(products.find((p) => p.mainProduct === mainProduct)),
    [products, mainProduct]
  );

  const mainExists = products.some((p) => p.mainProduct === mainProduct);

  // Default the dropdown to the first product once the list arrives.
  useEffect(() => {
    if (mainMode !== "existing") return;
    setMainInput((current) =>
      current && mainProductNames.includes(current) ? current : mainProductNames[0] ?? ""
    );
  }, [mainMode, mainProductNames]);

  const mainError = useMemo(() => {
    if (!mainProduct || NAME_PATTERN.test(mainProduct)) return null;
    return NAME_HINT;
  }, [mainProduct]);

  const subErrors = useMemo(
    () =>
      subs.map((raw) => {
        const value = raw.trim();
        if (!value) return null;
        if (!NAME_PATTERN.test(value)) return NAME_HINT;
        if (existingSubs.includes(value)) return "มีอยู่แล้วใน main product นี้";
        if (subs.filter((s) => s.trim() === value).length > 1) return "ซ้ำกับช่องอื่น";
        return null;
      }),
    [subs, existingSubs]
  );

  // Case-only clashes are legal but almost always a typo, so they warn instead
  // of blocking: "Order" and "order" really are two separate collections.
  const mainWarning = useMemo(() => {
    if (!mainProduct || mainError) return null;
    return findSimilar(mainProduct, mainProductNames) ?? null;
  }, [mainProduct, mainError, mainProductNames]);

  const subWarnings = useMemo(
    () =>
      subs.map((raw, index) => {
        const value = raw.trim();
        if (!value || subErrors[index]) return null;

        const similarExisting = findSimilar(value, existingSubs);
        if (similarExisting) return `มีชื่อคล้ายกันอยู่แล้ว: ${similarExisting}`;

        const otherRows = subs.filter((_, i) => i !== index).map((s) => s.trim());
        const similarRow = findSimilar(value, otherRows);
        if (similarRow) return `คล้ายกับอีกช่องหนึ่ง: ${similarRow}`;

        return null;
      }),
    [subs, subErrors, existingSubs]
  );

  const filledSubs = subs.map((s) => s.trim()).filter(Boolean);
  const canSubmit =
    !submitting &&
    Boolean(mainProduct) &&
    !mainError &&
    subErrors.every((e) => !e) &&
    // There is nothing to save without a subproduct, in either mode.
    filledSubs.length > 0 &&
    // "Pick an existing one" must not quietly create a new product when the
    // typed name matches nothing.
    (mainMode === "new" || mainExists);

  const updateSub = (index: number, value: string) =>
    setSubs((prev) => prev.map((s, i) => (i === index ? value : s)));

  const removeSubRow = (index: number) =>
    setSubs((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const resp = await fetch(`/api/addproductname`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainProduct, subProduct: filledSubs }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || `Request failed: ${resp.status}`);

      const lines = [
        data.added?.length
          ? `เพิ่ม subproduct: ${data.added.join(", ")}`
          : "ไม่มี subproduct ใหม่ถูกเพิ่ม",
      ];
      if (data.skipped?.length) {
        lines.push(`ข้าม: ${data.skipped.map((s: any) => `${s.name} (${s.reason})`).join(", ")}`);
      }
      if (data.warnings?.length) {
        lines.push(
          `⚠️ มีชื่อคล้ายกันอยู่แล้ว (ต่างแค่ตัวพิมพ์): ${data.warnings
            .map((w: any) => `${w.name} → ${w.similarTo}`)
            .join(", ")}`
        );
      }
      lines.push("<small>ยังไม่มีข้อมูลเทสต์ จนกว่า pipeline จะส่งผลเข้ามา</small>");

      await Swal.fire({
        icon: data.warnings?.length ? "warning" : "success",
        title: data.created
          ? `สร้าง ${data.mainProduct} แล้ว`
          : `อัปเดต ${data.mainProduct} แล้ว`,
        html: lines.join("<br/>"),
      });

      if (mainMode === "new") setMainInput("");
      setSubs([""]);
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
        <h1 className="text-3xl font-bold">เพิ่ม Product</h1>
        <p className="text-gray-300 mt-1">
          ลงทะเบียนชื่อ main product / sub product ไว้ล่วงหน้า โดยยังไม่ต้องมีผลเทสต์
          &mdash; ชื่อจะขึ้นที่เมนูด้านซ้ายทันที และรอจนกว่า pipeline จะส่งข้อมูลเข้ามา
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-2 bg-[#2f3a4a] rounded-lg p-6 border border-gray-600"
        >
          <div className="mb-6">
            <label className="block font-semibold mb-2">Main product</label>

            <div className="flex gap-4 mb-3 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mainMode"
                  checked={mainMode === "new"}
                  onChange={() => {
                    setMainMode("new");
                    setMainInput("");
                  }}
                />
                สร้างใหม่
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mainMode"
                  checked={mainMode === "existing"}
                  onChange={() => setMainMode("existing")}
                  disabled={products.length === 0}
                />
                เลือกจากที่มีอยู่
              </label>
            </div>

            {loading ? (
              <LoadingState variant="simple" label="Loading products..." />
            ) : mainMode === "new" ? (
              <input
                type="text"
                className={INPUT_CLASS}
                placeholder="เช่น SDP"
                value={mainInput}
                onChange={(e) => setMainInput(e.target.value)}
              />
            ) : (
              <Combobox
                value={mainInput}
                onChange={setMainInput}
                options={mainProductNames}
                placeholder="พิมพ์เพื่อค้นหา หรือกด ▼ ดูทั้งหมด"
              />
            )}

            {mainError && <p className="text-red-400 text-sm mt-2">{mainError}</p>}
            {mainMode === "existing" && mainProduct && !mainExists && (
              <p className="text-red-400 text-sm mt-2">
                ไม่พบ main product ชื่อนี้ &mdash; ถ้าต้องการสร้างใหม่ ให้เลือก &quot;สร้างใหม่&quot;
              </p>
            )}
            {mainMode === "new" && mainProduct && !mainError && mainExists && (
              <p className="text-yellow-300 text-sm mt-2">
                main product นี้มีอยู่แล้ว &mdash; subproduct ที่กรอกจะถูกเพิ่มเข้าไปในของเดิม
              </p>
            )}
            {mainWarning && (
              <p className="text-yellow-300 text-sm mt-2">
                มีชื่อคล้ายกันอยู่แล้ว: <b>{mainWarning}</b> &mdash; ถ้ากดบันทึกต่อจะได้ main
                product ใหม่แยกอีกอัน
                {mainMode === "new" && (
                  <button
                    type="button"
                    onClick={() => setMainInput(mainWarning)}
                    className="ml-2 rounded px-2 py-0.5 bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                  >
                    ใช้ {mainWarning}
                  </button>
                )}
              </p>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block font-semibold">Sub product</label>
              <button
                type="button"
                onClick={() => setSubs((prev) => [...prev, ""])}
                className="text-sm rounded px-3 py-1 bg-gray-600 hover:bg-gray-500 transition-colors"
              >
                + เพิ่มช่อง
              </button>
            </div>

            {subs.map((value, index) => (
              <div key={index} className="mb-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="เช่น order"
                    value={value}
                    onChange={(e) => updateSub(index, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeSubRow(index)}
                    className="rounded px-3 py-2 bg-gray-600 hover:bg-[#f77575] transition-colors"
                    title="ลบช่องนี้"
                  >
                    &times;
                  </button>
                </div>
                {subErrors[index] && (
                  <p className="text-red-400 text-sm mt-1">{subErrors[index]}</p>
                )}
                {subWarnings[index] && (
                  <p className="text-yellow-300 text-sm mt-1">{subWarnings[index]}</p>
                )}
              </div>
            ))}

            <p className="text-gray-400 text-sm mt-2">
              ชื่อ sub product ถูกใช้เป็นชื่อ collection และเป็น URL ด้วย &mdash; {NAME_HINT}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded px-5 py-2 font-semibold bg-[#66c552] hover:bg-[#57ad46] disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="rounded px-5 py-2 bg-gray-600 hover:bg-gray-500 transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </form>

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

export default function AddProductPage() {
  return (
    <AdminOnly>
      <AddProductForm />
    </AdminOnly>
  );
}
