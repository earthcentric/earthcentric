"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Layers, 
  Search, 
  Edit3, 
  GitMerge, 
  Plus, 
  FolderTree, 
  Tag, 
  Loader2, 
  ArrowRight, 
  AlertTriangle,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { Card, Button, Input, Label, Badge } from "@/components/ui/shared";
import { renameCategory, mergeCategories, upsertCategory } from "@/actions/categories";
import Link from "next/link";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  productCount: number;
}

interface CategoryManagementViewProps {
  adminEmail?: string;
  globalSearch?: string;
}

export function CategoryManagementView({ adminEmail = "admin@earthcentric.com", globalSearch = "" }: CategoryManagementViewProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals state
  const [renameTarget, setRenameTarget] = useState<CategoryItem | null>(null);
  const [newName, setNewName] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  const [mergeSource, setMergeSource] = useState<CategoryItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories?for=seller");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (e) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  // Filter based on local and global search
  const effectiveSearch = (search || globalSearch).toLowerCase().trim();
  const filtered = categories.filter(c => 
    c.name.toLowerCase().includes(effectiveSearch) ||
    c.slug.toLowerCase().includes(effectiveSearch)
  );

  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  // Handle Rename
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;

    setRenameLoading(true);
    try {
      const res = await renameCategory(renameTarget.id, newName.trim(), adminEmail);
      if (res.success) {
        toast.success(`Category renamed to "${newName.trim()}"`);
        setRenameTarget(null);
        setNewName("");
        loadCategories();
      } else {
        toast.error(res.error || "Failed to rename category");
      }
    } catch (e: any) {
      toast.error(e?.message || "An unexpected error occurred");
    } finally {
      setRenameLoading(false);
    }
  };

  // Handle Merge
  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSource || !mergeTargetId) return;

    const targetCat = categories.find(c => c.id === mergeTargetId);
    if (!targetCat) return;

    if (!confirm(`Are you sure you want to merge "${mergeSource.name}" into "${targetCat.name}"? All ${mergeSource.productCount} product(s) will be transferred and "${mergeSource.name}" will be deleted.`)) {
      return;
    }

    setMergeLoading(true);
    try {
      const res = await mergeCategories(mergeSource.id, mergeTargetId, adminEmail);
      if (res.success) {
        toast.success(`Successfully merged! ${res.movedCount || 0} products transferred.`);
        setMergeSource(null);
        setMergeTargetId("");
        loadCategories();
      } else {
        toast.error(res.error || "Failed to merge categories");
      }
    } catch (e: any) {
      toast.error(e?.message || "An error occurred while merging");
    } finally {
      setMergeLoading(false);
    }
  };

  // Handle Manual Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setCreateLoading(true);
    try {
      const cat = await upsertCategory(createName.trim());
      toast.success(`Category "${cat.name}" is ready!`);
      setShowCreateModal(false);
      setCreateName("");
      loadCategories();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create category");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1a3321] flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-600" />
            Category & Taxonomy Manager
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage marketplace categories, normalize duplicate entries, rename taxonomies, or merge overlapping categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadCategories} 
            disabled={loading}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)} 
            className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs h-9 gap-1.5 shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Categories</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{categories.length}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FolderTree className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active with Products</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {categories.filter(c => c.productCount > 0).length}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Tag className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Categorized Items</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{totalProducts}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Table / Search Card */}
      <Card className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input 
              type="text"
              placeholder="Filter categories by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9 bg-slate-50 border-slate-200"
            />
          </div>
          <span className="text-xs text-muted-foreground self-center">
            Showing <strong>{filtered.length}</strong> of {categories.length} categories
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span>Loading category taxonomy...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No categories matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4">Category Name</th>
                  <th className="py-3 px-4">URL Slug</th>
                  <th className="py-3 px-4">Live Products</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{cat.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link 
                        href={`/category/${cat.slug}`}
                        target="_blank"
                        className="font-mono text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1 group"
                      >
                        <span>/category/{cat.slug}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        cat.productCount > 0 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                          : "bg-slate-100 text-slate-400"
                      }`}>
                        {cat.productCount} {cat.productCount === 1 ? "product" : "products"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {cat.productCount > 0 ? (
                        <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Visible on Marketplace
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          Seller typeahead only
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenameTarget(cat);
                            setNewName(cat.name);
                          }}
                          className="h-7 text-[11px] px-2.5 gap-1 border-slate-200 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3 w-3" />
                          Rename
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMergeSource(cat);
                            setMergeTargetId("");
                          }}
                          className="h-7 text-[11px] px-2.5 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          <GitMerge className="h-3 w-3" />
                          Merge
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modal: Rename Category ── */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setRenameTarget(null)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321] flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-emerald-600" />
              Rename Category
            </h3>
            <p className="text-xs text-muted-foreground">
              Renaming will update the category across all associated products and preserve existing URL redirects where possible.
            </p>
            <form onSubmit={handleRename} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">New Category Name</Label>
                <Input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new category name..."
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)} disabled={renameLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={renameLoading || !newName.trim() || newName.trim() === renameTarget.name}
                  className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs"
                >
                  {renameLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save Rename
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Modal: Merge Categories ── */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMergeSource(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321] flex items-center gap-2">
              <GitMerge className="h-4 w-4 text-amber-600" />
              Merge Category: "{mergeSource.name}"
            </h3>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-relaxed">
                All <strong>{mergeSource.productCount}</strong> products currently inside <strong>"{mergeSource.name}"</strong> will be reassigned to the target category. The source category will then be removed permanently.
              </p>
            </div>
            <form onSubmit={handleMerge} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Target Category</Label>
                <select
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  className="w-full border border-input rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-[#1a3321]"
                >
                  <option value="">-- Choose destination category --</option>
                  {categories
                    .filter(c => c.id !== mergeSource.id)
                    .map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.productCount} products)
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setMergeSource(null)} disabled={mergeLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={mergeLoading || !mergeTargetId}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
                >
                  {mergeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Confirm Merge
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Modal: Create Category ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <Card className="relative w-full max-w-sm p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321] flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              Add New Category
            </h3>
            <p className="text-xs text-muted-foreground">
              Add a standard category to the marketplace taxonomy. Duplicate names will be safely normalized.
            </p>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Name</Label>
                <Input
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Biodegradable Straws"
                  className="text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} disabled={createLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLoading || !createName.trim()}
                  className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs"
                >
                  {createLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Create Category
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
