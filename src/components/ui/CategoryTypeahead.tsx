"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, ChevronDown, Plus, Tag, Loader2 } from "lucide-react";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface CategoryTypeaheadProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export default function CategoryTypeahead({
  value,
  onChange,
  placeholder = "Type or select a category...",
  required = false,
  disabled = false,
  id = "category-typeahead",
}: CategoryTypeaheadProps) {
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [filtered, setFiltered] = useState<CategoryOption[]>([]);
  const [inputValue, setInputValue] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Fetch categories once on mount
  useEffect(() => {
    setIsLoading(true);
    fetch("/api/categories?for=seller")
      .then((r) => r.json())
      .then((data) => {
        setAllCategories(data.categories || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Sync external value → internal input
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Filter on input change
  useEffect(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) {
      setFiltered(allCategories.slice(0, 10));
    } else {
      const matches = allCategories.filter((c) =>
        c.name.toLowerCase().includes(q)
      );
      setFiltered(matches.slice(0, 10));
    }
    setHighlightIndex(-1);
  }, [inputValue, allCategories]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback(
    (cat: CategoryOption) => {
      setInputValue(cat.name);
      onChange(cat.name);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    onChange(v); // live update
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      } else {
        // Accept typed custom value
        onChange(inputValue);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Exact match check: is there a match in existing categories?
  const exactMatch = allCategories.find(
    (c) => c.name.toLowerCase() === inputValue.trim().toLowerCase()
  );
  const isNewCategory = inputValue.trim() && !exactMatch;

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={`w-full pl-9 pr-9 py-2 text-sm border rounded-xl bg-white text-slate-800 placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-[#0F6E56]/40 focus:border-[#0F6E56] transition-all
            ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-text"}
            ${isNewCategory ? "border-amber-400 bg-amber-50/30" : "border-slate-200"}
          `}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          )}
        </button>
      </div>

      {/* New category hint */}
      {isNewCategory && inputValue.trim().length > 1 && (
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <Plus className="h-3 w-3 text-amber-600 shrink-0" />
          <span className="text-[11px] text-amber-700 font-medium">
            New category <strong>"{inputValue.trim()}"</strong> will be created automatically (displays in marketplace upon Super Admin approval)
          </span>
        </div>
      )}
      {!isNewCategory && exactMatch && inputValue.trim() && (
        <div className="flex items-center gap-1.5 mt-1 px-1">
          <Tag className="h-3 w-3 text-[#0F6E56] shrink-0" />
          <span className="text-[11px] text-[#0F6E56] font-medium">
            Using existing category
          </span>
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          {filtered.length === 0 && inputValue.trim() ? (
            <div className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Plus className="h-4 w-4 text-amber-500 shrink-0" />
                <span>
                  Create new category{" "}
                  <strong className="text-slate-800">"{inputValue.trim()}"</strong>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 pl-6">
                This category will be created and will appear in the marketplace once your application is approved by Super Admin.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 italic">
              Start typing to search categories...
            </div>
          ) : (
            <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
              {filtered.map((cat, idx) => {
                const isHighlighted = idx === highlightIndex;
                const isSelected = cat.name.toLowerCase() === inputValue.toLowerCase();
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelect(cat);
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors
                        ${isHighlighted ? "bg-[#0F6E56]/8 text-[#0F6E56]" : "text-slate-700 hover:bg-slate-50"}
                        ${isSelected ? "font-bold text-[#0F6E56] bg-emerald-50" : ""}
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Tag className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-[#0F6E56]" : "text-slate-400"}`} />
                        <span className="text-sm truncate">{cat.name}</span>
                      </div>
                      {cat.productCount > 0 && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">
                          {cat.productCount} products
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* "Type to create new" footer hint */}
          {allCategories.length > 0 && (
            <div className="border-t border-slate-100 px-4 py-2 bg-slate-50/60">
              <p className="text-[10px] text-slate-400">
                💡 Can't find your category? Just type a new name and it will be created automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
