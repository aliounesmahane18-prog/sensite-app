"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Plus, Trash2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useImageUpload } from "@/lib/use-image-upload";
import ImageCropper from "@/components/image-cropper";

interface Variant { name: string; values: string[]; }

interface ProductFormProps {
  boutiqueId: string;
  userId: string;
  product?: {
    id: string; name: string; description: string | null; price: number;
    old_price: number | null; category: string | null; image_url: string | null;
    is_available: boolean; is_featured: boolean; has_variants: boolean; variants: Variant[];
  };
  onSuccess?: () => void;
}

export default function ProductForm({ boutiqueId, userId, product, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const imageUpload = useImageUpload();
  const [saving, setSaving] = useState(false);
  const [variants, setVariants] = useState<Variant[]>(product?.variants || []);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantValues, setNewVariantValues] = useState<Record<number, string>>({});

  const [form, setForm] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price?.toString() || "",
    old_price: product?.old_price?.toString() || "",
    category: product?.category || "",
    is_available: product?.is_available ?? true,
    is_featured: product?.is_featured ?? false,
    has_variants: product?.has_variants ?? false,
  });

  // Initialiser preview si modification
  useState(() => { if (product?.image_url) imageUpload.setPreview(product.image_url); });

  const addVariant = () => {
    if (!newVariantName.trim()) return;
    setVariants([...variants, { name: newVariantName.trim(), values: [] }]);
    setNewVariantName("");
  };

  const removeVariant = (i: number) => setVariants(variants.filter((_, j) => j !== i));

  const addVariantValue = (vi: number) => {
    const value = newVariantValues[vi]?.trim();
    if (!value) return;
    const updated = [...variants];
    if (!updated[vi].values.includes(value)) updated[vi].values.push(value);
    setVariants(updated);
    setNewVariantValues({ ...newVariantValues, [vi]: "" });
  };

  const removeVariantValue = (vi: number, val: string) => {
    const updated = [...variants];
    updated[vi].values = updated[vi].values.filter(v => v !== val);
    setVariants(updated);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageUpload.croppedBlob) return imageUpload.preview;
    const supabase = getSupabase();
    const path = `${boutiqueId}/${Date.now()}.jpg`;
    await supabase.storage.from("product-images").upload(path, imageUpload.croppedBlob, { contentType: "image/jpeg" });
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) { alert("Nom et prix obligatoires"); return; }
    setSaving(true);
    try {
      const supabase = getSupabase();
      const imageUrl = await uploadImage();
      const data = {
        boutique_id: boutiqueId, name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseInt(form.price), old_price: form.old_price ? parseInt(form.old_price) : null,
        category: form.category.trim() || null,
        is_available: form.is_available, is_featured: form.is_featured,
        has_variants: form.has_variants, variants: form.has_variants ? variants : [],
        image_url: imageUrl, created_by: userId,
      };
      if (product?.id) {
        const { error } = await supabase.from("products").update(data).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(data);
        if (error) throw error;
      }
      if (onSuccess) onSuccess();
      else router.push("/dashboard/produits");
    } catch (err: unknown) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally { setSaving(false); }
  };

  return (
    <>
      {/* Cropper overlay */}
      {imageUpload.showCropper && imageUpload.rawImage && (
        <ImageCropper
          imageSrc={imageUpload.rawImage}
          onCropComplete={imageUpload.handleCropComplete}
          onCancel={imageUpload.handleCropCancel}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto">
        {/* Image */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Photo du produit</label>
          <div onClick={imageUpload.openFilePicker}
            className="border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden">
            {imageUpload.preview ? (
              <div className="relative h-52">
                <Image src={imageUpload.preview} alt="Aperçu" fill className="object-cover" />
                <button type="button" onClick={(e) => { e.stopPropagation(); imageUpload.reset(); }}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md">
                  <X className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <span className="text-4xl mb-2">📷</span>
                <p className="text-sm font-medium">Clique pour ajouter une photo</p>
                <p className="text-xs">JPG, PNG jusqu&apos;à 10MB — recadrage disponible</p>
              </div>
            )}
          </div>
          <input ref={imageUpload.fileRef} type="file" accept="image/*" onChange={imageUpload.handleFileChange} className="hidden" />
        </div>

        {/* Infos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" rows={3} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Catégorie</label>
            <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Prix (FCFA) *</label>
              <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" required min={0} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Ancien prix</label>
              <input type="number" value={form.old_price} onChange={e => setForm({ ...form, old_price: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" min={0} />
            </div>
          </div>
        </div>

        {/* Variantes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.has_variants}
              onChange={e => setForm({ ...form, has_variants: e.target.checked })}
              className="w-4 h-4 accent-orange-500" />
            <span className="font-semibold text-gray-800">Ce produit a des variantes (tailles, couleurs...)</span>
          </label>
          {form.has_variants && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              {variants.map((variant, vi) => (
                <div key={vi} className="bg-gray-50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{variant.name}</span>
                    <button type="button" onClick={() => removeVariant(vi)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variant.values.map((val, i) => (
                      <span key={i} className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-lg text-xs">
                        {val}
                        <button type="button" onClick={() => removeVariantValue(vi, val)}>
                          <X className="w-3 h-3 text-gray-400 hover:text-red-500" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={newVariantValues[vi] || ""}
                      onChange={e => setNewVariantValues({ ...newVariantValues, [vi]: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariantValue(vi))}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 flex-1"
                      placeholder={`Ajouter une ${variant.name.toLowerCase()}...`} />
                    <button type="button" onClick={() => addVariantValue(vi)}
                      className="px-3 py-1.5 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input type="text" value={newVariantName}
                  onChange={e => setNewVariantName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariant())}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 flex-1"
                  placeholder="Nom de la variante (ex: Taille, Couleur...)" />
                <button type="button" onClick={addVariant}
                  className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm flex items-center gap-1 hover:bg-orange-600">
                  <Plus className="w-4 h-4" /> Ajouter
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_available}
              onChange={e => setForm({ ...form, is_available: e.target.checked })}
              className="w-4 h-4 accent-orange-500" />
            <span className="text-sm font-medium text-gray-700">Visible dans le catalogue</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_featured}
              onChange={e => setForm({ ...form, is_featured: e.target.checked })}
              className="w-4 h-4 accent-yellow-500" />
            <span className="text-sm font-medium text-gray-700">⭐ Mettre en vedette</span>
          </label>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push("/dashboard/produits")}
            className="flex-1 py-3 rounded-2xl border-2 border-gray-200 font-semibold text-gray-700">Annuler</button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-orange-500 text-white font-bold hover:bg-orange-600">
            {saving ? "Enregistrement..." : product?.id ? "Mettre à jour" : "Ajouter le produit"}
          </button>
        </div>
      </form>
    </>
  );
}
