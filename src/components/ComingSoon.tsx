import React from "react";

// Wraps a dashboard section that has nothing to show yet (a product registered
// ahead of its first test run). The real markup stays mounted but blurred, so
// the page keeps its shape instead of collapsing into a bare message.

type ComingSoonProps = {
  show: boolean;
  label?: string;
  detail?: string;
  /** "top" keeps the message in view when the blurred section is taller than the screen. */
  align?: "top" | "center";
  children: React.ReactNode;
};

export default function ComingSoon({
  show,
  label = "Data is coming soon",
  detail = "ยังไม่มีข้อมูล รอ pipeline ส่งผลเข้ามา",
  align = "top",
  children,
}: ComingSoonProps) {
  if (!show) return <>{children}</>;

  return (
    <div className="relative">
      <div
        className="blur-[5px] opacity-50 pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      <div
        className={`absolute inset-0 flex justify-center ${
          align === "top" ? "items-start pt-28" : "items-center"
        }`}
      >
        <div className="rounded-xl border border-gray-500/60 bg-[#2c3443]/95 px-10 py-8 text-center shadow-xl">
          <div className="text-2xl font-bold text-white">{label}</div>
          {detail && <div className="mt-2 text-sm text-gray-300">{detail}</div>}
        </div>
      </div>
    </div>
  );
}
