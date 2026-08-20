"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Save, X, Check } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { THEME_PRESETS } from "@/lib/themes";
import { useImageUpload } from "@/lib/use-image-upload";
import ImageCropper from "@/components/image-cropper";
import { SECTEURS } from "@/lib/secteurs";

export default function ParametresPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const logoUpload = useImageUpload();

  const [form, setForm] = useState({
    name: "",
    description: "",
    whatsapp_number: "",
    quartier: "",
    // Le secteur est porté par `category` : c'est la colonne que lisent le
    // filtre de la page d'accueil et les icônes de fond du catalogue.
    category: "autre",
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
          category: b.category || "autre",
          address: b.address || "",
          color_primary: b.color_primary || "#F97316",
          color_secondary: b.color_secondary || "#1C1917",
          color_accent: b.color_accent || "#EAB308",
          theme_preset: b.theme_preset || "custom",
        });
        if (b.logo_url) logoUpload.setPreview(b.logo_url);
      }
      setLoading(false);
    };
    load();
  }, [router]);

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setForm(f => ({ ...f, color_primary: preset.primary, color_secondary: preset.secondary, color_accent: preset.accent, theme_preset: preset.name }));
  };

  const uploadLogo = async (): Promise<string | null> => {
    // Pas de nouveau recadrage : on conserve le logo déjà enregistré.
    if (!logoUpload.croppedBlob || !boutiqueId) return logoUpload.preview;

    const supabase = getSupabase();
    // Le dossier porte l'id de la boutique : c'est ce que vérifient les
    // politiques RLS du bucket « boutique-logos ».
    const path = `${boutiqueId}/logo.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("boutique-logos")
      .upload(path, logoUpload.croppedBlob, { upsert: true, contentType: "image/jpeg" });
    if (uploadError) {
      throw new Error(`Envoi du logo impossible : ${uploadError.message}`);
    }

    const { data } = supabase.storage.from("boutique-logos").getPublicUrl(path);
    // Le chemin est fixe (upsert) : sans ce paramètre, le CDN continuerait de
    // servir l'ancienne image après un changement de logo.
    return `${data.publicUrl}?v=${Date.now()}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boutiqueId) return;
    setSaving(true);
    setError("");
    try {
      const supabase = getSupabase();
      const logoUrl = await uploadLogo();

      const { data, error: updateError } = await supabase
        .from("boutiques")
        .update({ ...form, logo_url: logoUrl })
        .eq("id", boutiqueId)
        .select("id, logo_url, color_primary, color_secondary, color_accent, theme_preset")
        .maybeSingle();

      if (updateError) throw updateError;
      // Un UPDATE bloqué par RLS ne renvoie pas d'erreur : il ne touche
      // simplement aucune ligne. Sans ce test, la page afficherait
      // « Sauvegardé ! » alors que rien n'a été écrit.
      if (!data) {
        throw new Error(
          "Aucune modification enregistrée : ton compte n'a pas les droits sur cette boutique. Contacte Ali.IA Solutions.",
        );
      }

      if (logoUrl) logoUpload.setPreview(logoUrl);
      logoUpload.clearCropped();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue lors de la sauvegarde.");
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
      {/* Cropper overlay */}
      {logoUpload.showCropper && logoUpload.rawImage && (
        <ImageCropper
          imageSrc={logoUpload.rawImage}
          onCropComplete={logoUpload.handleCropComplete}
          onCancel={logoUpload.handleCropCancel}
        />
      )}

      <h1 className="text-2xl font-bold text-gray-900">⚙️ Paramètres boutique</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}
        {/* Logo */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="font-bold text-gray-800 mb-3">🖼️ Logo</h2>
          <div className="flex items-center gap-4">
            <div onClick={logoUpload.openFilePicker}
              className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-orange-500 cursor-pointer transition-colors flex items-center justify-center"
              style={{ background: "#f5f5f5" }}>
              {logoUpload.preview ? (
                <>
                  <Image src={logoUpload.preview} alt="Logo" fill sizes="80px" className="object-contain" />
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
              <p className="text-xs text-gray-400">JPG, PNG jusqu&apos;à 10MB — tu pourras recadrer avant l&apos;envoi</p>
              {logoUpload.preview && (
                <button type="button" onClick={logoUpload.reset}
                  className="text-xs text-red-500 hover:underline mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" /> Supprimer
                </button>
              )}
            </div>
          </div>
          <input ref={logoUpload.fileRef} type="file" accept="image/*" onChange={logoUpload.handleFileChange} className="hidden" />
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
            <div>
              <label htmlFor="secteur" className="text-sm font-medium text-gray-700 mb-1 block">
                Secteur d&apos;activité
              </label>
              <select id="secteur" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                {SECTEURS.map(([cle, label]) => (
                  <option key={cle} value={cle}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Détermine le rayon où ta boutique apparaît sur la page d&apos;accueil.
              </p>
            </div>
          </div>
        </div>

        {/* Thème */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          <h2 className="font-bold text-gray-800">🎨 Thème couleurs</h2>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEME_PRESETS.map((preset) => (
              <button key={preset.name} type="button" onClick={() => applyPreset(preset)}
                className={`p-2 rounded-xl border-2 transition-all text-left ${form.theme_preset === preset.name ? "border-gray-900 shadow-md" : "border-gray-100 hover:border-gray-300"}`}>
                <div className="flex gap-1 mb-1">
                  {preset.preview.map((c, i) => <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />)}
                </div>
                <p className="text-xs font-medium text-gray-700 leading-tight">{preset.name}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "color_primary", label: "Principale", desc: "Header, boutons" },
              { key: "color_secondary", label: "Secondaire", desc: "Footer, fond" },
              { key: "color_accent", label: "Accent", desc: "Textes, badges" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="text-center">
                <div className="relative mx-auto w-12 h-12 rounded-xl overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors mb-1">
                  <div className="w-full h-full" style={{ background: form[key as keyof typeof form] as string }} />
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

        <button type="submit" disabled={saving}
          className="w-full py-3.5 rounded-2xl text-white font-bold flex items-center justify-center gap-2 transition-all"
          style={{ background: saved ? "#16A34A" : form.color_primary }}>
          {saved ? <><Check className="w-5 h-5" /> Sauvegardé !</> : saving ? "Sauvegarde..." : <><Save className="w-5 h-5" /> Sauvegarder</>}
        </button>
      </form>
    </div>
  );
}
