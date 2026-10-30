"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type BaseProps = Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> & {
  placeholder?: string;
  required?: boolean;
  children: React.ReactNode;
};

type SingleSelectProps = BaseProps & {
  multiple?: false;
  value?: string;
  onChange?: (value: string) => void;
};

type MultipleSelectProps = BaseProps & {
  multiple: true;
  value?: string[];
  onChange?: (value: string[]) => void;
};

type SelectProps = SingleSelectProps | MultipleSelectProps;

interface MenuPosition {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
}

const VIEWPORT_MARGIN = 8;
const MENU_GAP = 4;
const MENU_MAX_HEIGHT = 240;
const MOBILE_QUERY = "(max-width: 639px)";
const SCROLL_THUMB_CLASSES =
  "[scrollbar-width:thin] [scrollbar-color:rgba(0,0,0,0.4)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/40";

const toArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

export default function Select(allProps: SelectProps) {
  const {
    placeholder = "Select an option...",
    required = false,
    value: controlledValue,
    onChange,
    multiple = false,
    children,
    ...props
  } = allProps;

  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(
    toArray(controlledValue),
  );
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [query, setQuery] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const options = React.Children.toArray(children)
    .filter(
      (child): child is React.ReactElement =>
        React.isValidElement(child) && child.type === "option",
    )
    .map((child) => {
      // If option has value, use it. Otherwise use its text as the value.
      const value = String(child.props.value ?? child.props.children ?? "");
      const label = String(child.props.children ?? value);
      return { value, label };
    });

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = normalizedQuery
    ? options.filter((option) =>
        option.label.toLowerCase().includes(normalizedQuery),
      )
    : options;

  const selectedLabel = selectedValues
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter((label): label is string => Boolean(label))
    .join(", ");

  // Sync controlled value
  const controlledKey = Array.isArray(controlledValue)
    ? controlledValue.join("\u0000")
    : controlledValue;

  useEffect(() => {
    if (controlledValue === undefined) return;
    setSelectedValues(toArray(controlledValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledKey]);

  // Track mobile breakpoint
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Reset search whenever the menu closes
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  // Close on outside interaction or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Keep the desktop menu inside the viewport
  const updatePosition = useCallback(() => {
    const trigger = dropdownRef.current;
    const menu = menuRef.current;
    const list = listRef.current;
    if (!trigger || !menu || !list) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const spaceBelow =
      viewportHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - MENU_GAP - VIEWPORT_MARGIN;
    // Full content height: menu chrome (search, borders) + the list's own content
    const naturalHeight = Math.min(
      menu.offsetHeight - list.clientHeight + list.scrollHeight,
      MENU_MAX_HEIGHT,
    );

    const openUp = naturalHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      Math.min(MENU_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow),
      0,
    );
    const height = Math.min(naturalHeight, maxHeight);
    const top = openUp ? rect.top - MENU_GAP - height : rect.bottom + MENU_GAP;

    // Align to the trigger's left edge, flip to its right edge, then clamp
    const menuWidth = Math.min(
      Math.max(menu.offsetWidth, rect.width),
      viewportWidth - VIEWPORT_MARGIN * 2,
    );
    let left = rect.left;
    if (left + menuWidth > viewportWidth - VIEWPORT_MARGIN) {
      left = rect.right - menuWidth;
    }
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      viewportWidth - VIEWPORT_MARGIN - menuWidth,
    );

    setPosition({ top, left, minWidth: rect.width, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || isMobile) {
      setPosition(null);
      return;
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, isMobile, updatePosition, filteredOptions.length]);

  const handleSelect = (value: string) => {
    if (multiple) {
      const next = selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value];
      setSelectedValues(next);
      (onChange as MultipleSelectProps["onChange"])?.(next);
      return;
    }

    setSelectedValues([value]);
    setIsOpen(false);
    (onChange as SingleSelectProps["onChange"])?.(value);
  };

  const handleClear = () => {
    setSelectedValues([]);
    (onChange as MultipleSelectProps["onChange"])?.([]);
  };

  const renderSearch = () => (
    <div className="px-2 pb-1 pt-1">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        placeholder="Search..."
        aria-label="Search options"
        autoFocus={!isMobile}
        className="w-full rounded-md border border-black/30 px-3 py-1.5 text-sm outline-none focus:border-black"
      />
      {multiple && selectedValues.length > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="opacity-50">{selectedValues.length} selected</span>
          <button
            type="button"
            className="underline hover:opacity-70"
            onClick={(event) => {
              event.stopPropagation();
              handleClear();
            }}
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );

  const renderOptions = () =>
    filteredOptions.length === 0 ? (
      <p className="px-4 py-2 text-sm opacity-50">No results found</p>
    ) : (
      filteredOptions.map(({ value, label }, index) => {
        const isSelected = selectedValues.includes(value);

        return (
          <button
            key={`${value}-${index}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`text-left px-4 py-2 hover:bg-black/5 w-full flex items-center justify-between gap-2 ${
              isSelected ? "bg-black/5 font-medium" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              handleSelect(value);
            }}
          >
            <span>{label}</span>
            {isSelected && <span aria-hidden="true">✓</span>}
          </button>
        );
      })
    );

  const menu = isMobile ? (
    <div
      className="fixed inset-0 z-[1000] flex items-end bg-black/40"
      onClick={(event) => {
        event.stopPropagation();
        setIsOpen(false);
      }}
    >
      <div
        ref={menuRef}
        role="listbox"
        aria-multiselectable={multiple}
        className="bg-white w-full rounded-t-2xl py-2 flex flex-col shadow-xl max-h-[70vh]"
        onClick={(event) => event.stopPropagation()}
      >
        {renderSearch()}
        <div
          ref={listRef}
          className={`flex flex-col overflow-y-auto min-h-0 ${SCROLL_THUMB_CLASSES}`}
        >
          {renderOptions()}
        </div>
        {multiple && (
          <button
            type="button"
            className="mx-4 my-2 px-4 py-2 rounded-md bg-black text-white"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(false);
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  ) : (
    <div
      ref={menuRef}
      role="listbox"
      aria-multiselectable={multiple}
      className="bg-white border border-black fixed py-1 flex flex-col z-[1000] shadow-xl rounded-md"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        minWidth: position?.minWidth,
        maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxHeight: position?.maxHeight ?? MENU_MAX_HEIGHT,
        visibility: position ? "visible" : "hidden",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {renderSearch()}
      <div
        ref={listRef}
        className={`flex flex-col overflow-y-auto min-h-0 ${SCROLL_THUMB_CLASSES}`}
      >
        {renderOptions()}
      </div>
    </div>
  );

  return (
    <div
      ref={dropdownRef}
      className="py-2 my-2 min-h-10 border-b border-current relative flex items-center justify-between w-full cursor-pointer select-none"
      role="combobox"
      tabIndex={0}
      aria-label={props["aria-label"] ?? placeholder}
      aria-required={required}
      aria-haspopup="listbox"
      aria-expanded={isOpen}
      onClick={() => setIsOpen((prev) => !prev)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (["Enter", " ", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          setIsOpen(true);
        }
      }}
      {...props}
    >
      {multiple && selectedValues.length > 0 ? (
        selectedValues.map((value) => (
          <input
            key={value}
            type="hidden"
            name={props.id}
            value={value}
            readOnly
          />
        ))
      ) : (
        <input
          type="hidden"
          name={props.id}
          value={multiple ? "" : (selectedValues[0] ?? "")}
          readOnly
        />
      )}

      {/* Selected value */}
      <div className="bg-transparent outline-none w-full pointer-events-none absolute truncate pr-6">
        {selectedLabel}
      </div>

      {/* Placeholder */}
      <span
        className={`pointer-events-none transition-all duration-150 left-0 ${
          isOpen || selectedLabel
            ? "-translate-y-full opacity-50 text-xs"
            : "translate-y-0 opacity-100 text-sm"
        }`}
      >
        {placeholder}
      </span>

      {/* Arrow */}
      <svg
        width="11"
        height="7"
        viewBox="0 0 11 7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`transition-transform duration-200 ${
          isOpen ? "rotate-180" : ""
        }`}
      >
        <path
          d="M4.58605 5.99828L0.294875 1.70711C-0.33509 1.07714 0.111077 0 1.00198 0H9.58432C10.4752 0 10.9214 1.07714 10.2914 1.70711L6.00026 5.99828C5.60973 6.3888 4.97657 6.3888 4.58605 5.99828Z"
          fill="currentColor"
        />
      </svg>

      {/* Options (portaled so it layers above and escapes clipping ancestors) */}
      {isOpen && createPortal(menu, document.body)}
    </div>
  );
}
