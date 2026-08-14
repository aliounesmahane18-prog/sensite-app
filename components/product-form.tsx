"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { ErrorBanner } from "@/components/config-error";
import { getErrorMessage } from "@/lib/utils";

export interface ProductFormValues {
  name: string;
  description: string;
  price: string;
  old_price: string;
  category: string;
  is_available: boolean;
  is_featured: boolean;
  image_url: string | null;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: "",
  description: "",
  price: "",
  old_price: "",
  category: "",
  is_available: true,
  is_featured: false,
  image_url: null,
};

interface Props {
  boutiqueId: string;
  /** `undefined` = création, sinon mise à jour du produit correspondant. */
  productId?: string;
  initialValues?: ProductFormValues;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function ProductForm({ boutiqueId, productId, initialValues }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProductFormValues>(initialValues ?? EMPTY_PRODUCT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialValues?.image_url ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(productId);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Photo trop lourde (5 Mo maximum).");
      return;
    }
    setError("");
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const uploadImage = async (file: File): Promise<string> => {
    const supabase = getSupabase();
    const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${boutiqueId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension || "jpg"}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (uploadError) {
      throw new Error(`Envoi de la photo impossible : ${uploadError.message}`);
    }

    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const price = Number.parseInt(form.price, 10);
    if (!form.name.trim()) {
      setError("Le nom du produit est obligatoire.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("Le prix doit être un nombre positif.");
      return;
    }
    const oldPrice = form.old_price ? Number.parseInt(form.old_price, 10) : null;
    if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < 0)) {
      setError("L'ancien prix doit être un nombre positif.");
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabase();
      const imageUrl = imageFile ? await uploadImage(imageFile) : form.image_url;

      const values = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        old_price: oldPrice,
        category: form.category.trim() || null,
        is_available: form.is_available,
        is_featured: form.is_featured,
        image_url: imageUrl,
      };

      const { error: writeError } = isEdit
        ? await supabase.from("products").update(values).eq("id", productId)
        : await supabase.from("products").insert({ ...values, boutique_id: boutiqueId });

      if (writeError) throw new Error(writeError.message);

      router.push("/dashboard/produits");
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="card p-4">
        <span className="label">Photo du produit</span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden block"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Aperçu du produit" className="w-full h-48 object-cover" />
          ) : (
            <span className="flex flex-col items-center justify-center py-10 text-gray-400">
              <span className="text-4xl mb-2">📷</span>
              <span className="text-sm">Clique pour ajouter une photo</span>
            </span>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </div>

      <div className="card p-4 space-y-4">
        <div>
          <label className="label" htmlFor="product-name">
            Nom du produit *
          </label>
          <input
            id="product-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="Ex: Robe en wax"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="product-description">
            Description
          </label>
          <textarea
            id="product-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-field resize-none"
            rows={3}
            placeholder="Décris le produit..."
          />
        </div>
        <div>
          <label className="label" htmlFor="product-category">
            Catégorie
          </label>
          <input
            id="product-category"
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="input-field"
            placeholder="Ex: Robes, Chaussures..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="product-price">
              Prix (FCFA) *
            </label>
            <input
              id="product-price"
              type="number"
              inputMode="numeric"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="input-field"
              placeholder="25000"
              required
              min={0}
            />
          </div>
          <div>
            <label className="label" htmlFor="product-old-price">
              Ancien prix (promo)
            </label>
            <input
              id="product-old-price"
              type="number"
              inputMode="numeric"
              value={form.old_price}
              onChange={(e) => setForm({ ...form, old_price: e.target.value })}
              className="input-field"
              placeholder="35000"
              min={0}
            />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
            className="w-4 h-4 accent-orange-500"
          />
          <span className="text-sm font-medium text-gray-700">Visible dans le catalogue</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_featured}
            onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
            className="w-4 h-4 accent-yellow-500"
          />
          <span className="text-sm font-medium text-gray-700">⭐ Mettre en vedette</span>
        </label>
      </div>

      <div className="flex gap-3">
        <Link href="/dashboard/produits" className="btn-secondary flex-1 text-center">
          Annuler
        </Link>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Ajouter le produit"}
        </button>
      </div>
    </form>
  );
}
