import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Swal from "sweetalert2";
import LoadingState from "../components/LoadingState";
import { isAdmin, useRole } from "../lib/role";

// Register a main product / sub product name up front, before any test result
// has been pushed for it. Only the name is stored (in the product_name
// collection); the subproduct's own collection stays empty until a pipeline
// sends data.

type SubProduct = { name: string };
type Product = { mainProduct: string; subProduct?: Array<string | SubProduct> };

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const NAME_HINT =
  "ใช้ได้เฉพาะ a-z A-Z 0-9 . _ - (1-64 ตัว) และต้องขึ้นต้นด้วยตัวอักษรหรือตัวเลข";

function subName(sub: string | SubProduct): string {
  return typeof sub === "string" ? sub : sub?.name;
}

/**
 * A name from `list` that matches `value` apart from letter case. Names that
 * differ only by case are legal and distinct (a subproduct becomes its own
 * MongoDB collection), so this drives a warning rather than a hard error.
 */
function findSimilar(value: string, list: string[]): string | undefined {
  const lower = value.toLowerCase();
  return list.find((name) => name !== value && name.toLowerCase() === lower);
}

export default function AddProductPage() {
  const router = useRouter();
  const role = useRole();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mainMode, setMainMode] = useState<"existing" | "new">("new");
  const [existingMain, setExistingMain] = useState("");
  const [newMain, setNewMain] = useState("");
  const [subs, setSubs] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setLoadError(null);
    try {
      const resp = await fetch(`/api/getnewproductname`);
      if (!resp.ok) throw new Error(`Network response was not ok: ${resp.status}`);
      const data = await resp.json();
      const list = (data.products || []) as Product[];
      setProducts(list);
      setExistingMain((current) =>
        current && list.some((p) => p.mainProduct === current)
          ? current
          : list[0]?.mainProduct ?? ""
      );
    } catch (err: any) {
      setLoadError(err?.message ?? String(err));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const mainProduct = (mainMode === "existing" ? existingMain : newMain).trim();

  const currentSubsOfMain = useMemo(() => {
    const found = products.find((p) => p.mainProduct === mainProduct);
    return (found?.subProduct ?? []).map(subName).filter(Boolean) as string[];
  }, [products, mainProduct]);

  // Per-field problems, shown inline so the form explains itself before submit.
  const mainError = useMemo(() => {
    if (!mainProduct) return null;
    if (!NAME_PATTERN.test(mainProduct)) return NAME_HINT;
    return null;
  }, [mainProduct]);

  const subErrors = useMemo(
    () =>
      subs.map((raw) => {
        const value = raw.trim();
        if (!value) return null;
        if (!NAME_PATTERN.test(value)) return NAME_HINT;
        if (currentSubsOfMain.includes(value)) return "มีอยู่แล้วใน main product นี้";
        if (subs.filter((s) => s.trim() === value).length > 1) return "ซ้ำกับช่องอื่น";
        return null;
      }),
    [subs, currentSubsOfMain]
  );

  // Case-only clashes: allowed, but flagged so a stray "Order" next to an
  // existing "order" doesn't quietly become a second collection.
  const mainWarning = useMemo(() => {
    if (!mainProduct || mainError) return null;
    return findSimilar(
      mainProduct,
      products.map((p) => p.mainProduct)
    );
  }, [mainProduct, mainError, products]);

  const subWarnings = useMemo(
    () =>
      subs.map((raw, index) => {
        const value = raw.trim();
        if (!value || subErrors[index]) return null;

        const similarExisting = findSimilar(value, currentSubsOfMain);
        if (similarExisting) return `มีชื่อคล้ายกันอยู่แล้ว: ${similarExisting}`;

        const otherRows = subs.filter((_, i) => i !== index).map((s) => s.trim());
        const similarRow = findSimilar(value, otherRows);
        if (similarRow) return `คล้ายกับอีกช่องหนึ่ง: ${similarRow}`;

        return null;
      }),
    [subs, subErrors, currentSubsOfMain]
  );

  const filledSubs = subs.map((s) => s.trim()).filter(Boolean);
  const canSubmit =
    !submitting &&
    Boolean(mainProduct) &&
    !mainError &&
    subErrors.every((e) => !e) &&
    // A brand-new main product needs at least one subproduct to be useful.
    (mainMode === "existing" || filledSubs.length > 0);

  const updateSub = (index: number, value: string) => {
    setSubs((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const addSubRow = () => setSubs((prev) => [...prev, ""]);

  const removeSubRow = (index: number) => {
    setSubs((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const addedText = data.added?.length
        ? `เพิ่ม subproduct: ${data.added.join(", ")}`
        : "ไม่มี subproduct ใหม่ถูกเพิ่ม";
      const skippedText = data.skipped?.length
        ? `<br/>ข้าม: ${data.skipped
            .map((s: any) => `${s.name} (${s.reason})`)
            .join(", ")}`
        : "";
      const warningText = data.warnings?.length
        ? `<br/><br/>⚠️ มีชื่อคล้ายกันอยู่แล้ว (ต่างแค่ตัวพิมพ์): ${data.warnings
            .map((w: any) => `${w.name} → ${w.similarTo}`)
            .join(", ")}`
        : "";

      await Swal.fire({
        icon: data.warnings?.length ? "warning" : "success",
        title: data.created
          ? `สร้าง ${data.mainProduct} แล้ว`
          : `อัปเดต ${data.mainProduct} แล้ว`,
        html: `${addedText}${skippedText}${warningText}<br/><br/><small>ยังไม่มีข้อมูลเทสต์ จนกว่า pipeline จะส่งผลเข้ามา</small>`,
      });

      setNewMain("");
      setSubs([""]);
      await loadProducts();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: err?.message ?? String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded bg-[#2b3545] border border-gray-600 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-300";

  // The navbar hides the entry point for non-admins; guard the URL too so the
  // page is not reachable just by typing it. (Cookie-based, so this matches the
  // navbar rather than being a real permission check.)
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
        {/* Form */}
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
                  onChange={() => setMainMode("new")}
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

            {mainMode === "new" ? (
              <input
                type="text"
                className={inputClass}
                placeholder="เช่น SDP"
                value={newMain}
                onChange={(e) => setNewMain(e.target.value)}
              />
            ) : (
              <select
                className={inputClass}
                value={existingMain}
                onChange={(e) => setExistingMain(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.mainProduct} value={p.mainProduct}>
                    {p.mainProduct}
                  </option>
                ))}
              </select>
            )}

            {mainError && <p className="text-red-400 text-sm mt-2">{mainError}</p>}
            {mainMode === "new" &&
              mainProduct &&
              !mainError &&
              products.some((p) => p.mainProduct === mainProduct) && (
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
                    onClick={() => setNewMain(mainWarning)}
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
                onClick={addSubRow}
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
                    className={inputClass}
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

        {/* Existing products, for reference while filling the form */}
        <aside className="bg-[#2f3a4a] rounded-lg p-6 border border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">ที่มีอยู่แล้ว</h2>
            <button
              type="button"
              onClick={loadProducts}
              className="text-sm rounded px-3 py-1 bg-gray-600 hover:bg-gray-500 transition-colors"
            >
              รีเฟรช
            </button>
          </div>

          {loadingProducts ? (
            <LoadingState variant="simple" label="Loading products..." />
          ) : loadError ? (
            <div className="text-red-400">Error: {loadError}</div>
          ) : products.length === 0 ? (
            <div className="text-gray-400">ยังไม่มี product</div>
          ) : (
            <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {products.map((p) => (
                <li key={p.mainProduct}>
                  <div className="font-semibold">{p.mainProduct}</div>
                  <div className="text-sm text-gray-300 pl-3">
                    {(p.subProduct ?? []).length === 0
                      ? "-"
                      : (p.subProduct ?? []).map(subName).filter(Boolean).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
