"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Variant {
  name: string;
  values: string[];
}

interface ProductFormProps {
  boutiqueId: string;
  userId: string;
  product?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    old_price: number | null;
    category: string | null;
    image_url: string | null;
    is_available: boolean;
    is_featured: boolean;
    has_variants: boolean;
    variants: Variant[];
  };
  onSuccess?: () => void;
}

export default function ProductForm({ boutiqueId, userId, product, onSuccess }: ProductFormProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(product?.image_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);

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

  const [variants, setVariants] = useState<Variant[]>(
    product?.variants || []
  );
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantValues, setNewVariantValues] = useState<Record<number, string>>({});

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Image trop lourde (max 5MB)"); return; }
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const addVariant = () => {
    if (!newVariantName.trim()) return;
    setVariants([...variants, { name: newVariantName.trim(), values: [] }]);
    setNewVariantName("");
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const addVariantValue = (variantIndex: number) => {
    const value = newVariantValues[variantIndex]?.trim();
    if (!value) return;
    const updated = [...variants];
    if (!updated[variantIndex].values.includes(value)) {
      updated[variantIndex].values.push(value);
    }
    setVariants(updated);
    setNewVariantValues({ ...newVariantValues, [variantIndex]: "" });
  };

  const removeVariantValue = (variantIndex: number, value: string) => {
    const updated = [...variants];
    updated[variantIndex].values = updated[variantIndex].values.filter(v => v !== value);
    setVariants(updated);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return preview;
    const ext = imageFile.name.split(".").pop();
    const path = `${boutiqueId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, imageFile);
    if (error) { alert("Erreur upload image"); return null; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) { alert("Nom et prix obligatoires"); return; }
    setSaving(true);
    try {
      const imageUrl = await uploadImage();
      const productData = {
        boutique_id: boutiqueId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseInt(form.price),
        old_price: form.old_price ? parseInt(form.old_price) : null,
        category: form.category.trim() || null,
        is_available: form.is_available,
        is_featured: form.is_featured,
        has_variants: form.has_variants,
        variants: form.has_variants ? variants : [],
        image_url: imageUrl,
        created_by: userId,
      };

      if (product?.id) {
        const { error } = await supabase.from("products").update(productData).eq("id", product.id);
        if (error) throw error;
        alert("✅ Produit mis à jour !");
      } else {
        const { error } = await supabase.from("products").insert(productData);
        if (error) throw error;
        alert("✅ Produit ajouté !");
      }

      if (onSuccess) onSuccess();
      else router.push("/dashboard/produits");
    } catch (err: unknown) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto">
      {/* Image */}
      <div className="card p-4">
        <label className="label">Photo du produit</label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden"
        >
          {preview ? (
            <div className="relative h-52">
              <Image src={preview} alt="Aperçu" fill className="object-cover" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreview(null); setImageFile(null); }}
                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <span className="text-4xl mb-2">📷</span>
              <p className="text-sm">Clique pour ajouter une photo</p>
              <p className="text-xs">JPG, PNG — max 5MB</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </div>

      {/* Infos de base */}
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Nom du produit *</label>
          <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="input-field" placeholder="Ex: Robe en wax" required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="input-field resize-none" rows={3} placeholder="Décris le produit..." />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
            className="input-field" placeholder="Ex: Robes, Chaussures..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Prix (FCFA) *</label>
            <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
              className="input-field" placeholder="25000" required min={0} />
          </div>
          <div>
            <label className="label">Ancien prix (promo)</label>
            <input type="number" value={form.old_price} onChange={e => setForm({ ...form, old_price: e.target.value })}
              className="input-field" placeholder="35000" min={0} />
          </div>
        </div>
      </div>

      {/* Variantes */}
      <div className="card p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={form.has_variants}
            onChange={e => setForm({ ...form, has_variants: e.target.checked })}
            className="w-4 h-4 accent-orange-500" />
          <span className="font-semibold text-gray-800">Ce produit a des variantes (tailles, couleurs...)</span>
        </label>

        {form.has_variants && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            {/* Variantes existantes */}
            {variants.map((variant, vi) => (
              <div key={vi} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-gray-800">{variant.name}</span>
                  <button type="button" onClick={() => removeVariant(vi)}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {/* Valeurs */}
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
                {/* Ajouter valeur */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVariantValues[vi] || ""}
                    onChange={e => setNewVariantValues({ ...newVariantValues, [vi]: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariantValue(vi))}
                    className="input-field text-sm py-1.5 flex-1"
                    placeholder={`Ajouter une ${variant.name.toLowerCase()}...`}
                  />
                  <button type="button" onClick={() => addVariantValue(vi)}
                    className="btn-secondary text-sm py-1.5 px-3">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Ajouter une variante */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newVariantName}
                onChange={e => setNewVariantName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addVariant())}
                className="input-field text-sm flex-1"
                placeholder="Nom de la variante (ex: Taille, Couleur...)"
              />
              <button type="button" onClick={addVariant}
                className="btn-primary text-sm px-4 flex items-center gap-1">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>
            <p className="text-xs text-gray-400">Ex: Variante "Taille" avec valeurs S, M, L, XL</p>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="card p-4 space-y-3">
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
          className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Enregistrement..." : product?.id ? "Mettre à jour" : "Ajouter le produit"}
        </button>
      </div>
    </form>
  );
}
