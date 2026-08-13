"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function NouveauProduitPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", old_price: "", category: "", is_available: true, is_featured: false });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("boutique_id").eq("id", user.id).single();
      setBoutiqueId(p?.boutique_id || null);
    };
    load();
  }, []);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price || !boutiqueId) return;
    setSaving(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const path = `${boutiqueId}/${Date.now()}.${imageFile.name.split(".").pop()}`;
        await supabase.storage.from("product-images").upload(path, imageFile);
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
      await supabase.from("products").insert({
        boutique_id: boutiqueId,
        name: form.name,
        description: form.description || null,
        price: parseInt(form.price),
        old_price: form.old_price ? parseInt(form.old_price) : null,
        category: form.category || null,
        is_available: form.is_available,
        is_featured: form.is_featured,
        image_url: imageUrl,
      });
      router.push("/dashboard/produits");
    } catch { alert("Erreur lors de l'enregistrement"); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/produits" className="text-gray-400 hover:text-gray-700">←</Link>
        <h1 className="section-title">Nouveau produit</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-4">
          <label className="label">Photo du produit</label>
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:border-orange-500 transition-colors overflow-hidden">
            {preview ? <img src={preview} alt="preview" className="w-full h-48 object-cover" /> :
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <span className="text-4xl mb-2">📷</span><p className="text-sm">Clique pour ajouter une photo</p>
              </div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
        </div>
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Nom du produit *</label>
            <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Ex: Robe en wax" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field resize-none" rows={3} placeholder="Décris le produit..." />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <input type="text" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field" placeholder="Ex: Robes, Chaussures..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prix (FCFA) *</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="input-field" placeholder="25000" required min={0} />
            </div>
            <div>
              <label className="label">Ancien prix (promo)</label>
              <input type="number" value={form.old_price} onChange={e => setForm({...form, old_price: e.target.value})} className="input-field" placeholder="35000" min={0} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_available} onChange={e => setForm({...form, is_available: e.target.checked})} className="w-4 h-4 accent-orange-500" />
            <span className="text-sm font-medium text-gray-700">Visible dans le catalogue</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})} className="w-4 h-4 accent-yellow-500" />
            <span className="text-sm font-medium text-gray-700">⭐ Mettre en vedette</span>
          </label>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/produits" className="btn-secondary flex-1 text-center">Annuler</Link>
          <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? "Enregistrement..." : "Ajouter le produit"}</button>
        </div>
      </form>
    </div>
  );
}
