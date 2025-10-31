import React, { memo, useState } from "react";

type Flag = "all" | "fail" | "error" | "pass" | undefined;

interface MenuItemProps {
  /** Name of parent menu (use for top-level items) */
  mainproduct?: string;
  /** Name of a single child item (renders as indented item) */
  subproduct?: string;
  /** Optional array of child names or child objects for expandable menus */
  subproducts?: Array<string | { name: string; flag?: Flag }>;
  /** flag to show small status indicators: 'all'|'fail'|'error' */
  flag?: Flag;
  onClick?: () => void;
  /** Called when an item (main or sub) is selected. Receives (mainProduct, subProduct?) */
  onSelect?: (main?: string, sub?: string) => void;
  /** active state helpers (passed from parent to highlight items) */
  activeMain?: string | undefined;
  activeSub?: string | undefined;
  /** boolean to explicitly mark this item active */
  active?: boolean;
  className?: string;
}

/**
 * Reusable MenuItem component
 * - If `subproducts` is provided and non-empty the item becomes expandable (chevron on the right).
 * - If `subproduct` is provided this renders a child/indented item.
 * - `flag` controls status dots: 'all' shows both red & yellow, 'fail' red, 'error' yellow.
 */
const MenuItem = memo((props: MenuItemProps) => {
  const {
    mainproduct,
    subproduct,
    subproducts,
    flag,
    onClick,
    className,
    onSelect,
    activeMain,
    activeSub,
    active,
  } = props;

  const [open, setOpen] = useState(false);

  // label chooses subproduct first (child) otherwise mainproduct
  const label = subproduct ?? mainproduct;
  if (!label) return null;

  const isSub = Boolean(subproduct);
  const hasChildren = Array.isArray(subproducts) && subproducts.length > 0;

  // determine if this item is active (explicit active prop wins)
  const isActive =
    active ??
    (isSub
      ? activeMain === mainproduct && activeSub === subproduct
      : activeMain === mainproduct && typeof activeSub === "undefined");

  // Handlers: clicking label triggers onClick (if provided); clicking chevron toggles open
  const handleLabelClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // If the item is already active, ignore duplicate clicks.
    if (isActive) return;
    if (onClick) onClick();
  };

  const handleToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpen((s) => !s);
  };

  return (
    <>
      <div>
        <div
          className={`flex items-center justify-between ${
            isActive ? "bg-gray-600 font-bold" : ""
          } rounded-md hover:bg-gray-700 transition-colors ${
            isSub
              ? "pl-6 py-1 cursor-pointer"
              : hasChildren
              ? "py-2 px-2 cursor-pointer"
              : "py-2 px-2"
          } ${className ?? ""}`}
          onClick={
            isSub ? handleLabelClick : hasChildren ? handleToggle : undefined
          }
          role={
            isSub && onClick ? "button" : hasChildren ? "button" : undefined
          }
        >
          {/* Left: label */}
          <div className={`flex-1`}>
            <span
              className={`${
                isSub
                  ? "text-base text-gray-200"
                  : "text-lg font-medium text-white"
              }`}
            >
              {label}
            </span>
          </div>

          {/* Middle: flags */}
          <div className="flex items-center space-x-2 mr-2" aria-hidden="true">
            {(flag === "fail" || flag === "all") && (
              <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-red-500" />
            )}
            {(flag === "error" || flag === "all") && (
              <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-yellow-400" />
            )}
          </div>

          {/* Right: vertical chevron (toggle) */}
          <div className="flex items-center justify-center w-6">
            {hasChildren && (
              <button
                type="button"
                onClick={handleToggle}
                aria-expanded={open}
                aria-label={open ? "Collapse submenu" : "Expand submenu"}
                className="p-0"
              >
                <svg
                  className={`h-6 w-6 text-gray-300 transform transition-transform ${
                    open ? "rotate-180" : "rotate-0"
                  }`}
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  {/* chevron down */}
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 8l4 4 4-4"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Children list (rendered when open) */}
        {hasChildren && open && (
          <div className="mt-1">
            {subproducts!.map((child) => {
              if (typeof child === "string") {
                const childActive =
                  activeMain === mainproduct && activeSub === child;
                return (
                  <MenuItem
                    key={child}
                    subproduct={child}
                    onClick={() => onSelect?.(mainproduct, child)}
                    active={childActive}
                  />
                );
              }
              const childActive =
                activeMain === mainproduct && activeSub === child.name;
              return (
                <MenuItem
                  key={child.name}
                  subproduct={child.name}
                  flag={child.flag}
                  className="pl-6"
                  onClick={() => onSelect?.(mainproduct, child.name)}
                  active={childActive}
                />
              );
            })}
            <div className="border-t border-gray-700 mt-2 pt-2"></div>
          </div>
        )}
      </div>
    </>
  );
});

export default MenuItem;
