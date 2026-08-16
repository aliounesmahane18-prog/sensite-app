"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Save, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function ParametresPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    whatsapp_number: "",
    quartier: "",
    address: "",
    color_primary: "#F97316",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("boutique_id").eq("id", user.id).single();
      if (!profile?.boutique_id) { setLoading(false); return; }
      setBoutiqueId(profile.boutique_id);
      const { data: b } = await supabase.from("boutiques").select("*").eq("id", profile.boutique_id).single();
      if (b) {
        setForm({
          name: b.name || "",
          description: b.description || "",
          whatsapp_number: b.whatsapp_number || "",
          quartier: b.quartier || "",
          address: b.address || "",
          color_primary: b.color_primary || "#F97316",
        });
        setLogoPreview(b.logo_url || null);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Logo trop lourd (max 2MB)"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !boutiqueId) return logoPreview;
    const ext = logoFile.name.split(".").pop();
    const path = `${boutiqueId}/logo.${ext}`;
    await supabase.storage.from("boutique-logos").upload(path, logoFile, { upsert: true });
    const { data } = supabase.storage.from("boutique-logos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boutiqueId) return;
    setSaving(true);
    try {
      const logoUrl = await uploadLogo();
      const { error } = await supabase.from("boutiques").update({
        ...form,
        logo_url: logoUrl,
      }).eq("id", boutiqueId);
      if (error) throw error;
      alert("✅ Paramètres sauvegardés !");
    } catch (err: unknown) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const COLORS = ["#F97316", "#EC4899", "#3B82F6", "#16A34A", "#EAB308", "#8B5CF6", "#6B7280", "#DC2626"];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Paramètres boutique</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Logo */}
        <div className="card p-4">
          <label className="label">Logo de la boutique</label>
          <div className="flex items-center gap-4">
            <div
              onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-orange-500 cursor-pointer transition-colors bg-gray-50 flex items-center justify-center"
            >
              {logoPreview ? (
                <>
                  <Image src={logoPreview} alt="Logo" fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <Camera className="w-6 h-6 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-400 mt-1">Logo</p>
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">Clique sur l&apos;image pour changer le logo</p>
              <p className="text-xs text-gray-400">JPG, PNG — max 2MB</p>
              {logoPreview && (
                <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                  className="text-xs text-red-500 hover:underline mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" /> Supprimer le logo
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
        </div>

        {/* Infos */}
        <div className="card p-4 space-y-4">
          <div>
            <label className="label">Nom de la boutique *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="input-field" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field resize-none" rows={3} placeholder="Décris ta boutique..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">WhatsApp *</label>
              <input type="tel" value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })}
                className="input-field" placeholder="+221 77..." required />
            </div>
            <div>
              <label className="label">Quartier</label>
              <input type="text" value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })}
                className="input-field" placeholder="Médina..." />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="input-field" placeholder="Rue 10, Villa 25..." />
          </div>

          {/* Couleur principale */}
          <div>
            <label className="label">Couleur principale</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color_primary: c })}
                  className={`w-8 h-8 rounded-xl transition-all ${form.color_primary === c ? "ring-2 ring-offset-2 ring-gray-900 scale-110" : ""}`}
                  style={{ background: c }} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Cette couleur s&apos;affiche sur ton catalogue client</p>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Sauvegarde..." : "Sauvegarder les paramètres"}
        </button>
      </form>
    </div>
  );
}
