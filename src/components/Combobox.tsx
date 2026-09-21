import React, { useEffect, useMemo, useRef, useState } from "react";

// Text input that filters a list as you type, plus a ▼ button that opens the
// full list. Styled to match the dashboard instead of relying on the browser's
// native <datalist> popup.

type ComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
};

export default function Combobox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  emptyText = "ไม่พบรายการ",
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, value]);

  // Close when a click lands outside the widget.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Keep the highlight on a row that still exists after the list changes.
  useEffect(() => {
    setHighlight(0);
  }, [value, open]);

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      if (open && matches[highlight]) {
        event.preventDefault();
        select(matches[highlight]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex gap-2">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          className="w-full rounded bg-[#2b3545] border border-gray-600 px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-gray-300 disabled:opacity-50"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className="rounded px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="แสดงรายการทั้งหมด"
        >
          ▼
        </button>
      </div>

      {open && !disabled && (
        <ul className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded border border-gray-600 bg-[#2b3545] shadow-xl">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">{emptyText}</li>
          ) : (
            matches.map((option, index) => (
              <li key={option}>
                <button
                  type="button"
                  // Keep focus on the input so the blur does not close the list
                  // before the click is handled.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => select(option)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    index === highlight
                      ? "bg-gray-600 text-white"
                      : "text-gray-200 hover:bg-gray-700"
                  }`}
                >
                  {option}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
