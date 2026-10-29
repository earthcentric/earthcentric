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
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { Card, Button, Input, Label, Badge } from "@/components/ui/shared";
import { 
  adminCreateCategory, 
  adminUpdateCategory, 
  mergeCategories, 
  deleteCategory,
  normalizeCategorySlug
} from "@/actions/categories";
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

  // Modals state: Edit / Rename Details
  const [editTarget, setEditTarget] = useState<CategoryItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Modals state: Merge
  const [mergeSource, setMergeSource] = useState<CategoryItem | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergeLoading, setMergeLoading] = useState(false);

  // Modals state: Delete
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleteReassignId, setDeleteReassignId] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Modals state: Create
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories?for=seller");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
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

  // Open Edit Modal
  const openEditModal = (cat: CategoryItem) => {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditSlug(cat.slug);
    setEditDescription(cat.description || "");
  };

  // Handle Edit / Rename
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget || !editName.trim()) return;

    setEditLoading(true);
    try {
      const res = await adminUpdateCategory(
        editTarget.id,
        {
          name: editName.trim(),
          slug: editSlug.trim() || undefined,
          description: editDescription.trim() || undefined,
        },
        adminEmail
      );
      if (res.success && res.category) {
        toast.success(`Category "${res.category.name}" updated successfully.`);
        setEditTarget(null);
        loadCategories();
      } else {
        toast.error(res.error || "Failed to update category.");
      }
    } catch (e: any) {
      toast.error(e?.message || "An unexpected error occurred.");
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Merge
  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeSource || !mergeTargetId) return;

    const targetCat = categories.find(c => c.id === mergeTargetId);
    if (!targetCat) return;

    setMergeLoading(true);
    try {
      const res = await mergeCategories(mergeSource.id, mergeTargetId, adminEmail);
      if (res.success) {
        toast.success(`Successfully merged! ${res.movedCount || 0} product(s) transferred.`);
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

  // Handle Delete
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteTarget) return;

    if (deleteTarget.productCount > 0 && !deleteReassignId) {
      toast.error("Please choose a destination category to reassign active products before deleting.");
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await deleteCategory(
        deleteTarget.id,
        { reassignToCategoryId: deleteReassignId || undefined },
        adminEmail
      );

      if (res.success) {
        toast.success(
          res.movedCount && res.movedCount > 0
            ? `Category deleted. ${res.movedCount} product(s) reassigned successfully.`
            : `Category "${deleteTarget.name}" deleted successfully.`
        );
        setDeleteTarget(null);
        setDeleteReassignId("");
        loadCategories();
      } else {
        toast.error(res.error || "Failed to delete category.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete category.");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Handle Create Category
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setCreateLoading(true);
    try {
      const res = await adminCreateCategory(
        {
          name: createName.trim(),
          slug: createSlug.trim() || undefined,
          description: createDescription.trim() || undefined,
        },
        adminEmail
      );

      if (res.success && res.category) {
        toast.success(`Category "${res.category.name}" created and live!`);
        setShowCreateModal(false);
        setCreateName("");
        setCreateSlug("");
        setCreateDescription("");
        loadCategories();
      } else {
        toast.error(res.error || "Failed to create category");
      }
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
            className="text-xs h-9 gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button 
            onClick={() => {
              setShowCreateModal(true);
              setCreateName("");
              setCreateSlug("");
              setCreateDescription("");
            }} 
            className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs h-9 gap-1.5 shadow-sm cursor-pointer"
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
                        <div>
                          <span>{cat.name}</span>
                          {cat.description && (
                            <p className="text-[10px] text-slate-400 font-normal line-clamp-1">{cat.description}</p>
                          )}
                        </div>
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
                          onClick={() => openEditModal(cat)}
                          className="h-7 text-[11px] px-2.5 gap-1 border-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMergeSource(cat);
                            setMergeTargetId("");
                          }}
                          className="h-7 text-[11px] px-2.5 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer"
                        >
                          <GitMerge className="h-3 w-3" />
                          Merge
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setDeleteTarget(cat);
                            setDeleteReassignId("");
                          }}
                          className="h-7 text-[11px] px-2 gap-1 border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
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

      {/* ── Modal: Edit / Rename Category ── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setEditTarget(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321] flex items-center gap-2">
              <Edit3 className="h-4 w-4 text-emerald-600" />
              Edit Category Details
            </h3>
            <p className="text-xs text-muted-foreground">
              Update category display name, slug, and optional description. Changes propagate instantly to all category selectors.
            </p>
            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category Name *</Label>
                <Input
                  required
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (!editSlug || editSlug === normalizeCategorySlug(editTarget.name)) {
                      setEditSlug(normalizeCategorySlug(e.target.value));
                    }
                  }}
                  placeholder="e.g. Biodegradable Cutlery"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">URL Slug *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">/category/</span>
                  <Input
                    required
                    value={editSlug}
                    onChange={(e) => setEditSlug(normalizeCategorySlug(e.target.value))}
                    placeholder="cutlery"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description (Optional)</Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Brief description of products in this category..."
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditTarget(null)} disabled={editLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editLoading || !editName.trim()}
                  className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs cursor-pointer"
                >
                  {editLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save Changes
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
                All <strong>{mergeSource.productCount}</strong> products currently inside <strong>"{mergeSource.name}"</strong> will be reassigned to the target category in a database transaction. The source category will then be deleted permanently.
              </p>
            </div>
            <form onSubmit={handleMerge} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Select Destination Category *</Label>
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
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5 cursor-pointer"
                >
                  {mergeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Confirm Merge
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Modal: Delete Category (With Dependency Safeguards) ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-rose-700 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose-600" />
              Delete Category: "{deleteTarget.name}"
            </h3>

            {deleteTarget.productCount > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-rose-900 leading-relaxed">
                    <strong>Safeguard Active:</strong> This category contains <strong>{deleteTarget.productCount}</strong> active product(s). To prevent orphaned products, you must choose a category to reassign these products to before deletion.
                  </div>
                </div>

                <form onSubmit={handleDeleteSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Reassign Products To *</Label>
                    <select
                      required
                      value={deleteReassignId}
                      onChange={(e) => setDeleteReassignId(e.target.value)}
                      className="w-full border border-input rounded-lg px-3 py-2 text-xs bg-background focus:outline-none focus:ring-2 focus:ring-rose-600"
                    >
                      <option value="">-- Choose reassignment category --</option>
                      {categories
                        .filter(c => c.id !== deleteTarget.id)
                        .map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.productCount} existing products)
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={deleteLoading || !deleteReassignId}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 cursor-pointer"
                    >
                      {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                      Reassign &amp; Delete
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete category <strong>"{deleteTarget.name}"</strong>? This category currently has 0 associated products.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    onClick={handleDeleteSubmit}
                    disabled={deleteLoading}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5 cursor-pointer"
                  >
                    {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Modal: Add New Category ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <Card className="relative w-full max-w-md p-6 bg-card border rounded-2xl shadow-xl z-10 space-y-4">
            <h3 className="font-bold text-sm text-[#1a3321] flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              Add New Category
            </h3>
            <p className="text-xs text-muted-foreground">
              Create a standard category in the marketplace taxonomy. Only Super Admins can add categories.
            </p>
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category Name *</Label>
                <Input
                  required
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value);
                    if (!createSlug || createSlug === normalizeCategorySlug(createName)) {
                      setCreateSlug(normalizeCategorySlug(e.target.value));
                    }
                  }}
                  placeholder="e.g. Biodegradable Straws"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">URL Slug *</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400 font-mono">/category/</span>
                  <Input
                    required
                    value={createSlug}
                    onChange={(e) => setCreateSlug(normalizeCategorySlug(e.target.value))}
                    placeholder="straws"
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Description (Optional)</Label>
                <Input
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Description of products in this category..."
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreateModal(false)} disabled={createLoading}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLoading || !createName.trim()}
                  className="bg-[#1a3321] hover:bg-[#25422d] text-white text-xs cursor-pointer"
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
