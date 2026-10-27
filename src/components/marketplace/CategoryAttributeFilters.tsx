"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from "lucide-react";

export interface CategoryAttribute {
  key: string;
  label: string;
  values: string[];
}

export interface AttributeFilter {
  [key: string]: string[]; // key → selected values
}

interface CategoryAttributeFiltersProps {
  categorySlug: string;
  selectedAttributes: AttributeFilter;
  onAttributeChange: (newFilters: AttributeFilter) => void;
  priceRange?: [number, number];
}

function AttributeSection({
  attr,
  selected,
  onChange,
}: {
  attr: CategoryAttribute;
  selected: string[];
  onChange: (key: string, values: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const selectedSet = new Set(selected);

  const toggle = (value: string) => {
    const next = selectedSet.has(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(attr.key, next);
  };

  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between text-left mb-2 cursor-pointer"
      >
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          {attr.label}
          {selected.length > 0 && (
            <span className="bg-[#0F6E56] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {selected.length}
            </span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-slate-400" />
        ) : (
          <ChevronDown className="h-3 w-3 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1.5 pl-0.5">
          {attr.values.map((val) => {
            const isChecked = selectedSet.has(val);
            return (
              <label
                key={val}
                className={`flex items-center gap-2.5 cursor-pointer px-2 py-1.5 rounded-lg transition-all text-xs font-medium
                  ${isChecked ? "bg-emerald-50 text-[#0F6E56]" : "text-slate-600 hover:bg-slate-50"}`}
              >
                <span
                  className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-all
                    ${isChecked ? "border-[#0F6E56] bg-[#0F6E56]" : "border-slate-300 bg-white"}`}
                >
                  {isChecked && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => toggle(val)}
                />
                <span className="truncate">{val}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CategoryAttributeFilters({
  categorySlug,
  selectedAttributes,
  onAttributeChange,
}: CategoryAttributeFiltersProps) {
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categorySlug) {
      setAttributes([]);
      return;
    }
    setLoading(true);
    fetch(`/api/categories/filters?slug=${encodeURIComponent(categorySlug)}`)
      .then((r) => r.json())
      .then((data) => setAttributes(data.attributes || []))
      .catch(() => setAttributes([]))
      .finally(() => setLoading(false));
  }, [categorySlug]);

  const handleChange = (key: string, values: string[]) => {
    const next = { ...selectedAttributes };
    if (values.length === 0) {
      delete next[key];
    } else {
      next[key] = values;
    }
    onAttributeChange(next);
  };

  // Active filter count
  const activeCount = Object.values(selectedAttributes).flat().length;

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border-t border-slate-100 pt-3">
            <div className="h-3 bg-slate-100 rounded w-1/3 mb-2" />
            <div className="space-y-1.5">
              {[1, 2].map((j) => (
                <div key={j} className="h-7 bg-slate-50 rounded-lg" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (attributes.length === 0) return null;

  return (
    <div className="space-y-0">
      {/* Header with clear */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <SlidersHorizontal className="h-3 w-3" />
          Product Attributes
          {activeCount > 0 && (
            <span className="bg-[#0F6E56] text-white text-[9px] font-bold rounded-full px-1.5 py-0.5 leading-none">
              {activeCount}
            </span>
          )}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onAttributeChange({})}
            className="text-[10px] text-slate-400 hover:text-red-500 flex items-center gap-0.5 cursor-pointer font-bold transition-colors"
          >
            <X className="h-2.5 w-2.5" />
            Clear
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {Object.entries(selectedAttributes).flatMap(([key, vals]) =>
            vals.map((val) => (
              <span
                key={`${key}-${val}`}
                className="inline-flex items-center gap-1 bg-emerald-50 text-[#0F6E56] border border-emerald-200 text-[10px] font-semibold px-2 py-1 rounded-full"
              >
                {val}
                <button
                  type="button"
                  onClick={() => handleChange(key, (selectedAttributes[key] || []).filter((v) => v !== val))}
                  className="hover:text-red-500 cursor-pointer"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))
          )}
        </div>
      )}

      {/* Attribute sections */}
      {attributes.map((attr) => (
        <AttributeSection
          key={attr.key}
          attr={attr}
          selected={selectedAttributes[attr.key] || []}
          onChange={handleChange}
        />
      ))}
    </div>
  );
}
