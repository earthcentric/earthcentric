"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, ChevronDown, Tag, Loader2, Check, AlertCircle, RefreshCw } from "lucide-react";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

interface CategoryTypeaheadProps {
  value: string;
  onChange: (value: string, category?: CategoryOption) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  helpMessage?: string;
}

export default function CategoryTypeahead({
  value,
  onChange,
  placeholder = "Select an existing category...",
  required = false,
  disabled = false,
  id = "category-typeahead",
  helpMessage = "Can't find your category? Please submit your application using the closest available category. The Super Admin can assign or create the appropriate category during review.",
}: CategoryTypeaheadProps) {
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/categories?for=seller");
      const data = await res.json();
      setAllCategories(data.categories || []);
    } catch {
      setAllCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Match the currently selected category object if available
  const selectedCategory = useMemo(() => {
    if (!value) return null;
    return (
      allCategories.find(
        (c) =>
          c.name.toLowerCase() === value.trim().toLowerCase() ||
          c.id === value.trim() ||
          c.slug === value.trim().toLowerCase()
      ) || null
    );
  }, [value, allCategories]);

  // Filter existing categories by search query
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCategories;
    return allCategories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [searchQuery, allCategories]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setHighlightIndex(-1);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  const handleSelect = useCallback(
    (cat: CategoryOption) => {
      onChange(cat.name, cat);
      setIsOpen(false);
      setSearchQuery("");
      setHighlightIndex(-1);
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && filtered[highlightIndex]) {
        handleSelect(filtered[highlightIndex]);
      } else if (filtered.length === 1) {
        handleSelect(filtered[0]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Trigger Button / Display */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full min-h-[42px] px-3.5 py-2 text-xs border rounded-xl bg-white flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs select-none
          ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "hover:border-[#2D5A40] focus:ring-2 focus:ring-[#2D5A40]/30 focus:outline-none"}
          ${isOpen ? "border-[#2D5A40] ring-2 ring-[#2D5A40]/20" : "border-slate-200"}
        `}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Tag className={`h-3.5 w-3.5 shrink-0 ${selectedCategory ? "text-[#2D5A40]" : "text-slate-400"}`} />
          {selectedCategory ? (
            <span className="font-bold text-[#1F3A2E] truncate">
              {selectedCategory.name}
            </span>
          ) : value ? (
            <span className="font-semibold text-slate-800 truncate">{value}</span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin" />
          ) : (
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          )}
        </div>
      </div>

      {/* Selected Indicator Pill */}
      {selectedCategory && (
        <div className="flex items-center justify-between mt-1 px-1 text-[11px] text-[#2D5A40]">
          <span className="flex items-center gap-1 font-medium">
            <Check className="h-3 w-3 text-emerald-600" />
            Approved marketplace category
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="text-xs text-emerald-700 hover:underline font-semibold cursor-pointer"
          >
            Change
          </button>
        </div>
      )}

      {/* Hidden input for standard HTML form validation */}
      <input
        type="hidden"
        value={selectedCategory?.name || value || ""}
        required={required}
      />

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search approved categories..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2D5A40]/30 focus:border-[#2D5A40]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* List Area */}
          <div className="max-h-60 overflow-y-auto">
            {allCategories.length === 0 && !isLoading ? (
              <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                <AlertCircle className="h-5 w-5 text-amber-500 mx-auto" />
                <p className="font-semibold text-slate-700">No categories available.</p>
                <p className="text-[11px] text-slate-400">Please contact the Super Admin.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-slate-600">
                  No matching category found for <strong className="text-slate-900">"{searchQuery.trim()}"</strong>.
                </p>
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-left text-[11px] text-[#1F3A2E] leading-relaxed">
                  💡 {helpMessage}
                </div>
              </div>
            ) : (
              <ul ref={listRef} className="py-1 divide-y divide-slate-50">
                {filtered.map((cat, idx) => {
                  const isHighlighted = idx === highlightIndex;
                  const isSelected = selectedCategory?.id === cat.id;

                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(cat);
                        }}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer
                          ${isHighlighted ? "bg-emerald-50 text-[#1F3A2E]" : "text-slate-700 hover:bg-slate-50"}
                          ${isSelected ? "font-bold text-[#2D5A40] bg-emerald-50/90" : ""}
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Tag className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-[#2D5A40]" : "text-slate-400"}`} />
                          <div className="truncate">
                            <span className="text-xs text-slate-800">{cat.name}</span>
                            {cat.description && (
                              <p className="text-[10px] text-slate-400 font-normal truncate max-w-xs">{cat.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {cat.productCount > 0 && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                            </span>
                          )}
                          {isSelected && <Check className="h-4 w-4 text-[#2D5A40]" />}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Help Guidance Footer */}
          {allCategories.length > 0 && (
            <div className="border-t border-slate-100 p-2.5 bg-slate-50/80 text-[10px] text-slate-500 flex items-start gap-1.5">
              <span className="shrink-0 text-emerald-700">🔒</span>
              <p className="leading-snug">
                Marketplace categories are centralized and managed exclusively by Super Admins.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
