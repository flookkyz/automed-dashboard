import React, { memo, useRef } from "react";

interface inputProps {
  placeholder: string;
  value: any;
  onChange: (value: string) => void;
}

const SearchInput = memo((props: inputProps) => {
  const { placeholder, value, onChange } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  // If caller passes a Tailwind width class (like 'w-64' or 'w-full'), use it.
  // Otherwise fallback to 'w-full'. This keeps the component flexible.

  const handleClear = () => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative w-full`}>
      {/* Magnifying glass icon on the left */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.5 15a6.5 6.5 0 1 1 4.596-11.068 6.5 6.5 0 0 1-4.596 11.068z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17l-3-3"
          />
        </svg>
      </span>

      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || "Search"}
        className={`block w-full pl-10 pr-10 py-2 bg-white border border-gray-600 rounded-[7px] text-black focus:outline-none focus:ring-none`}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />

      {/* Clear (X) button on the right - shows only when there is a value */}
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 hover:bg-gray-300 hover:rounded-full p-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 6l8 8M14 6l-8 8"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
});

export default SearchInput;
