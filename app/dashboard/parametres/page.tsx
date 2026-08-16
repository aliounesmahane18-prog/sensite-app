"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Save, X, Check } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { THEME_PRESETS } from "@/lib/themes";

export default function ParametresPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    whatsapp_number: "",
    quartier: "",
    address: "",
    color_primary: "#F97316",
    color_secondary: "#1C1917",
    color_accent: "#EAB308",
    theme_preset: "custom",
  });

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase();
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
          color_secondary: b.color_secondary || "#1C1917",
          color_accent: b.color_accent || "#EAB308",
          theme_preset: b.theme_preset || "custom",
        });
        setLogoPreview(b.logo_url || null);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setForm(f => ({ ...f, color_primary: preset.primary, color_secondary: preset.secondary, color_accent: preset.accent, theme_preset: preset.name }));
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Logo trop lourd (max 2MB)"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !boutiqueId) return logoPreview;
    const supabase = getSupabase();
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
      const supabase = getSupabase();
      const logoUrl = await uploadLogo();
      const { error } = await supabase.from("boutiques").update({ ...form, logo_url: logoUrl }).eq("id", boutiqueId);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      alert("Erreur : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      <h1 className="text-2xl font-bold text-gray-900">⚙️ Paramètres boutique</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Logo */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">🖼️ Logo</h2>
          <div className="flex items-center gap-4">
            <div onClick={() => fileRef.current?.click()}
              className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-orange-500 cursor-pointer transition-colors bg-gray-50 flex items-center justify-center">
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
              <p className="text-sm text-gray-600">Clique pour changer le logo</p>
              <p className="text-xs text-gray-400">JPG, PNG — max 2MB. Carré recommandé.</p>
              {logoPreview && (
                <button type="button" onClick={() => { setLogoPreview(null); setLogoFile(null); }}
                  className="text-xs text-red-500 hover:underline mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" /> Supprimer
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} className="hidden" />
        </div>

        {/* Infos */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-800">📋 Informations</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Nom *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">WhatsApp *</label>
              <input type="tel" value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quartier</label>
              <input type="text" value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>
          </div>
        </div>

        {/* Thème couleurs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-800">🎨 Thème couleurs</h2>

          {/* Aperçu live */}
          <div className="rounded-2xl overflow-hidden border border-gray-100">
            <div className="h-12 flex items-center px-4 gap-2" style={{ background: form.color_primary }}>
              <div className="w-6 h-6 bg-white/20 rounded-lg" />
              <span className="text-white font-bold text-sm">{form.name || "Ma Boutique"}</span>
            </div>
            <div className="p-3 flex gap-2" style={{ background: form.color_secondary + "22" }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 rounded-xl overflow-hidden border border-gray-100 bg-white">
                  <div className="h-10 bg-gray-100" />
                  <div className="p-2">
                    <div className="h-2 bg-gray-200 rounded mb-1" />
                    <div className="h-3 rounded" style={{ background: form.color_primary, width: "60%" }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-8 flex items-center justify-center" style={{ background: form.color_secondary }}>
              <span className="text-xs font-bold" style={{ color: form.color_accent }}>SENsiteAPP</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">Aperçu de ton catalogue avec ces couleurs</p>

          {/* Palettes prédéfinies */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Palettes prédéfinies</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {THEME_PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset)}
                  className={`p-2 rounded-xl border-2 transition-all text-left ${
                    form.theme_preset === preset.name ? "border-gray-900 shadow-md" : "border-gray-100 hover:border-gray-300"
                  }`}>
                  <div className="flex gap-1 mb-1">
                    {preset.preview.map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs font-medium text-gray-700 leading-tight">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Personnalisation */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Personnaliser les couleurs</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "color_primary", label: "Principale", desc: "Header, boutons, prix" },
                { key: "color_secondary", label: "Secondaire", desc: "Footer, fond page" },
                { key: "color_accent", label: "Accent", desc: "Textes, highlights" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="text-center">
                  <div className="relative mx-auto w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors mb-1">
                    <div className="w-full h-full" style={{ background: form[key as keyof typeof form] }} />
                    <input type="color" value={form[key as keyof typeof form] as string}
                      onChange={e => setForm({ ...form, [key]: e.target.value, theme_preset: "custom" })}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  </div>
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all"
          style={{ background: saved ? "#16A34A" : form.color_primary }}>
          {saved ? <><Check className="w-5 h-5" /> Sauvegardé !</> : saving ? "Sauvegarde..." : <><Save className="w-5 h-5" /> Sauvegarder</>}
        </button>
      </form>
    </div>
  );
}
