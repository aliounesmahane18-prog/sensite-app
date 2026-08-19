"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { getSupabase } from "@/lib/supabase";

const FORMATS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_OCTETS = 5 * 1024 * 1024;

interface Props {
  boutiqueId: string;
  logoUrl: string | null;
  onUploaded: (url: string | null) => void;
}

/**
 * Upload du logo d'une boutique vers `boutique-logos/<boutique_id>/logo.<ext>`.
 *
 * Le dossier porte l'id de la boutique : c'est exactement ce que vérifient les
 * politiques RLS du bucket, côté gérant comme côté prospecteur. Pas de SVG —
 * un SVG peut embarquer du script et le bucket est public.
 */
export default function LogoUpload({ boutiqueId, logoUrl, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(logoUrl);
  const [envoi, setEnvoi] = useState(false);
  const [error, setError] = useState("");

  const choisir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = ""; // permet de re-choisir le même fichier
    if (!file) return;

    const ext = FORMATS[file.type];
    if (!ext) {
      setError("Format non accepté. Utilise un JPG, PNG, WEBP ou GIF.");
      return;
    }
    if (file.size > MAX_OCTETS) {
      setError("Image trop lourde (5 Mo maximum).");
      return;
    }

    setError("");
    // Aperçu immédiat, avant même l'envoi.
    const local = URL.createObjectURL(file);
    setPreview(local);
    setEnvoi(true);

    try {
      const supabase = getSupabase();
      const chemin = `${boutiqueId}/logo.${ext}`;

      // Un changement d'extension laisserait l'ancien fichier orphelin.
      const ancien = logoUrl?.split("?")[0].split("/boutique-logos/")[1];
      if (ancien && ancien !== chemin) {
        await supabase.storage.from("boutique-logos").remove([ancien]);
      }

      const { error: upError } = await supabase.storage
        .from("boutique-logos")
        .upload(chemin, file, { upsert: true, contentType: file.type });
      if (upError) throw new Error(`Envoi impossible : ${upError.message}`);

      const { data } = supabase.storage.from("boutique-logos").getPublicUrl(chemin);
      // Le chemin est fixe : sans ce paramètre le CDN servirait l'ancienne image.
      const url = `${data.publicUrl}?v=${Date.now()}`;

      const { data: maj, error: dbError } = await supabase
        .from("boutiques")
        .update({ logo_url: url })
        .eq("id", boutiqueId)
        .select("logo_url")
        .maybeSingle();
      if (dbError) throw new Error(dbError.message);
      // Un UPDATE bloqué par RLS ne lève pas d'erreur : il ne touche aucune ligne.
      if (!maj) throw new Error("Enregistrement refusé : droits insuffisants sur cette boutique.");

      setPreview(url);
      onUploaded(url);
    } catch (err) {
      setPreview(logoUrl);
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  const supprimer = async () => {
    setError("");
    setEnvoi(true);
    try {
      const supabase = getSupabase();
      const ancien = logoUrl?.split("?")[0].split("/boutique-logos/")[1];
      if (ancien) await supabase.storage.from("boutique-logos").remove([ancien]);

      const { data, error: dbError } = await supabase
        .from("boutiques")
        .update({ logo_url: null })
        .eq("id", boutiqueId)
        .select("id")
        .maybeSingle();
      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error("Suppression refusée : droits insuffisants.");

      setPreview(null);
      onUploaded(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suppression impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <h2 className="font-bold text-gray-900">🖼️ Logo</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded-xl text-xs">{error}</div>
      )}

      <div className="flex items-center gap-4">
        {/* contain + fond neutre : un logo n'est jamais rogné */}
        <div
          className="relative w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 shrink-0"
          style={{ background: "#f5f5f5" }}
        >
          {preview ? (
            <Image src={preview} alt="Logo de la boutique" fill sizes="64px" className="object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">🏪</div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={envoi}
              className="btn-secondary text-sm"
            >
              {envoi ? "Envoi..." : preview ? "Changer le logo" : "Choisir un logo"}
            </button>
            {preview && !envoi && (
              <button type="button" onClick={supprimer} className="text-xs text-red-500 hover:underline">
                Supprimer
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP ou GIF — 5 Mo maximum.</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={choisir}
        className="hidden"
      />
    </div>
  );
}
