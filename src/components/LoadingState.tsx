import React from "react";

export default function LoadingState({
  variant = "simple",
  label = "Loading...",
}: {
  variant?: "simple" | "fullscreen" | "dashboard" | "overview";
  label?: string;
}) {
  if (variant === "simple") {
    return (
      <div className="p-4" role="status" aria-live="polite">
        <div className="inline-flex items-center gap-3 text-gray-200">
          <div className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
          <span className="text-sm">{label}</span>
        </div>
      </div>
    );
  }

  if (variant === "fullscreen") {
    return (
      <div
        className="fixed inset-0 z-50 bg-gray-900/50 flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div className="flex flex-col items-center gap-4 text-gray-100">
          <div className="h-10 w-10 rounded-full border-4 border-gray-300 border-t-transparent animate-spin" />
          <div className="text-sm font-medium">{label}</div>
        </div>
      </div>
    );
  }

  if (variant === "dashboard") {
    return (
      <div className="p-4" role="status" aria-live="polite" aria-label={label}>
        <div className="animate-pulse">
          {/* Header row */}
          <div className="flex justify-between items-center mb-6">
            <div className="h-7 w-72 bg-gray-600/60 rounded" />
            <div className="h-10 w-56 bg-gray-600/40 rounded" />
          </div>

          <div className="h-7 w-72 bg-gray-600/50 rounded mx-auto mb-6" />

          {/* Chart + cards */}
          <div className="w-full mt-6 px-12 flex justify-between items-center sm:flex-col md:flex-row">
            <div className="w-[30vw] h-full flex flex-col items-center justify-center">
              <div className="w-[20vw] h-[20vw] bg-[#364153] rounded-full p-4 flex items-center justify-center">
                <div className="w-2/3 h-2/3 rounded-full bg-gray-700/50" />
              </div>
            </div>

            <div className="w-[50vw] grid grid-cols-2 gap-6 font-bold">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="relative rounded-lg p-1 bg-gray-500/50 overflow-hidden"
                >
                  <div className="bg-[#364153] rounded-lg p-6 h-32 flex flex-col items-center justify-center">
                    <div className="h-8 w-20 bg-gray-600/60 rounded mb-3" />
                    <div className="h-5 w-24 bg-gray-600/50 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="p-4 md:p-8 overflow-x-auto">
            <div className="h-6 w-56 bg-gray-600/60 rounded mb-4" />
            <div className="flex items-center gap-2 mb-4">
              <div className="h-5 w-40 bg-gray-600/50 rounded" />
              <div className="h-10 w-64 bg-gray-600/40 rounded" />
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[800px] rounded-lg overflow-hidden">
                <div className="h-10 bg-gray-800/80" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 bg-gray-500/60 border-t border-gray-700/40"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Overview skeleton: lightweight DOM + CSS-only animation
  return (
    <div className="p-4" role="status" aria-live="polite" aria-label={label}>
      <div className="animate-pulse">
        <div className="h-7 w-64 bg-gray-600/60 rounded mb-6" />

        <div className="w-full mt-6 px-12 flex justify-between items-center sm:flex-col md:flex-row">
          {/* Doughnut placeholder */}
          <div className="w-[30vw] h-full flex flex-col items-center justify-center">
            <div className="w-[20vw] h-[20vw] bg-[#364153] rounded-full p-4 flex items-center justify-center">
              <div className="w-2/3 h-2/3 rounded-full bg-gray-700/50" />
            </div>
          </div>

          {/* 4 cards placeholder */}
          <div className="w-[50vw] grid grid-cols-2 gap-6 font-bold">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="relative rounded-lg p-1 bg-gray-500/50 overflow-hidden"
              >
                <div className="bg-[#364153] rounded-lg p-6 h-32 flex flex-col items-center justify-center">
                  <div className="h-8 w-20 bg-gray-600/60 rounded mb-3" />
                  <div className="h-5 w-24 bg-gray-600/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table placeholder */}
        <div className="p-4 md:p-8 overflow-x-auto">
          <div className="h-6 w-40 bg-gray-600/60 rounded mb-4" />
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-36 bg-gray-600/50 rounded" />
            <div className="h-10 w-64 bg-gray-600/40 rounded" />
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px] rounded-lg overflow-hidden">
              <div className="h-10 bg-gray-800/80" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-500/60 border-t border-gray-700/40" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
