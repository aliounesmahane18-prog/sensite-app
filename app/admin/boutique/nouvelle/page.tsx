"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NouvelleBoutiquePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", category: "bazar", whatsapp_number: "", quartier: "", monthly_price: "5000", manager_email: "", manager_name: "" });

  const slugify = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.whatsapp_number || !form.manager_email) { alert("Remplis tous les champs obligatoires"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.manager_email, password: `SEN${Math.random().toString(36).slice(-6).toUpperCase()}!` }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data: b } = await supabase.from("boutiques").insert({ name: form.name, slug: slugify(form.name) || `boutique-${Date.now()}`, category: form.category, whatsapp_number: form.whatsapp_number, quartier: form.quartier || null, monthly_price: parseInt(form.monthly_price), subscription_status: "pending" }).select().single();
      await supabase.from("profiles").insert({ id: json.userId, email: form.manager_email, full_name: form.manager_name || null, role: "manager", boutique_id: b.id });
      alert(`✅ Boutique créée !\nURL: ${process.env.NEXT_PUBLIC_APP_URL}/boutique/${b.slug}\nEmail: ${form.manager_email}`);
      router.push("/admin");
    } catch (err: unknown) { alert((err as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-xl mx-auto px-4 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-700">←</Link>
          <h1 className="section-title">Nouvelle boutique</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-900">🏪 Infos boutique</h2>
            <div><label className="label">Nom *</label><input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Mode Dakar" required /></div>
            {form.name && <p className="text-xs text-gray-400">URL : <span className="text-orange-500 font-mono">/boutique/{slugify(form.name)}</span></p>}
            <div><label className="label">Catégorie</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="input-field">
                {[["pret_a_porter","Prêt-à-porter"],["electromenager","Électroménager"],["bazar","Bazar"],["quincaillerie","Quincaillerie"],["bijouterie","Bijouterie"],["autre","Autre"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">WhatsApp *</label><input type="tel" value={form.whatsapp_number} onChange={e => setForm({...form, whatsapp_number: e.target.value})} className="input-field" placeholder="+221 77..." required /></div>
              <div><label className="label">Quartier</label><input type="text" value={form.quartier} onChange={e => setForm({...form, quartier: e.target.value})} className="input-field" placeholder="Médina..." /></div>
            </div>
            <div><label className="label">Prix mensuel (FCFA)</label><input type="number" value={form.monthly_price} onChange={e => setForm({...form, monthly_price: e.target.value})} className="input-field" /></div>
          </div>
          <div className="card p-5 space-y-4">
            <h2 className="font-bold text-gray-900">👤 Compte gérant</h2>
            <div><label className="label">Email *</label><input type="email" value={form.manager_email} onChange={e => setForm({...form, manager_email: e.target.value})} className="input-field" placeholder="gerant@boutique.com" required /></div>
            <div><label className="label">Nom</label><input type="text" value={form.manager_name} onChange={e => setForm({...form, manager_name: e.target.value})} className="input-field" placeholder="Moussa Diallo" /></div>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="btn-secondary flex-1 text-center">Annuler</Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? "Création..." : "Créer la boutique"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
