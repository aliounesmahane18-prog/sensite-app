"use client";
import { useCallback, useEffect, useState } from "react";
import { getAccessToken, getSupabase } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { emailMasque, LONGUEUR_MOT_DE_PASSE_MIN } from "@/lib/gerant-partage";
import ChampsCompteGerant from "@/components/champs-compte-gerant";

type Mode =
  /** Le prospecteur gère le compte du gérant d'une de ses boutiques. */
  | { mode: "prospecteur"; boutiqueId: string }
  /** Le gérant change son propre mot de passe. */
  | { mode: "gerant"; email: string };

/**
 * Section « accès » des paramètres boutique.
 *
 * Deux chemins très différents derrière la même interface :
 * — le prospecteur passe par une route serveur, parce que modifier le compte
 *   d'un AUTRE utilisateur exige la clé service role ;
 * — le gérant utilise `auth.updateUser`, qui agit sur sa propre session et ne
 *   demande aucun privilège particulier.
 */
export default function AccesGerant(props: Mode) {
  const [emailGerant, setEmailGerant] = useState<string | null>(
    props.mode === "gerant" ? props.email : null,
  );
  const [chargement, setChargement] = useState(props.mode === "prospecteur");
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Création du compte quand la boutique n'en a pas encore.
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");

  const boutiqueId = props.mode === "prospecteur" ? props.boutiqueId : null;

  const charger = useCallback(async () => {
    if (!boutiqueId) return;
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/prospecteur/boutiques/${boutiqueId}/gerant`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEmailGerant(json.gerant?.email ?? null);
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setChargement(false);
    }
  }, [boutiqueId]);

  useEffect(() => {
    charger();
  }, [charger]);

  const creerLeCompte = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setSucces("");
    setEnvoi(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/prospecteur/boutiques/${boutiqueId}/gerant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ email: nouvelEmail.trim(), password: nouveauMdp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEmailGerant(json.gerant.email);
      setNouvelEmail("");
      setNouveauMdp("");
      setSucces("Compte gérant créé ✅ — transmets les identifiants au gérant.");
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  const changerMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setSucces("");

    if (mdp.length < LONGUEUR_MOT_DE_PASSE_MIN) {
      setErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères`);
      return;
    }
    if (mdp !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setEnvoi(true);
    try {
      if (props.mode === "gerant") {
        // Le gérant est connecté : sa propre session suffit.
        const { error } = await getSupabase().auth.updateUser({ password: mdp });
        if (error) throw new Error(error.message);
      } else {
        const token = await getAccessToken();
        const res = await fetch(`/api/prospecteur/boutiques/${boutiqueId}/gerant`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
          body: JSON.stringify({ password: mdp }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
      }
      setMdp("");
      setConfirmation("");
      setSucces("Mot de passe mis à jour ✅");
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  const titre = props.mode === "gerant" ? "🔐 Mon accès" : "🔐 Accès gérant";

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-bold text-gray-900">{titre}</h2>

      {erreur && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm">{erreur}</div>
      )}
      {succes && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-xl text-sm">
          {succes}
        </div>
      )}

      {chargement ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : emailGerant === null ? (
        // Cas des boutiques créées avant que le compte gérant soit obligatoire.
        <form onSubmit={creerLeCompte} className="space-y-4">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
            Cette boutique n&apos;a pas encore de compte gérant : son propriétaire ne peut pas se
            connecter. Crée-lui un accès.
          </p>
          <ChampsCompteGerant
            prefixe="ag"
            email={nouvelEmail}
            motDePasse={nouveauMdp}
            onEmail={setNouvelEmail}
            onMotDePasse={setNouveauMdp}
          />
          <button type="submit" disabled={envoi} className="btn-primary w-full">
            {envoi ? "Création…" : "Créer le compte gérant"}
          </button>
        </form>
      ) : (
        <form onSubmit={changerMotDePasse} className="space-y-4">
          <div>
            <span className="label">Email {props.mode === "gerant" ? "" : "du gérant"}</span>
            <p className="input-field bg-gray-50 text-gray-600">
              {props.mode === "gerant" ? emailGerant : emailMasque(emailGerant)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {props.mode === "gerant"
                ? "L'email de connexion ne se change pas ici."
                : "Masqué volontairement."}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="ag-nouveau">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="ag-nouveau"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
                className="input-field pr-20"
                placeholder={`${LONGUEUR_MOT_DE_PASSE_MIN} caractères minimum`}
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 hover:text-orange-500 px-2 py-1"
                aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {visible ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ag-confirmation">
              Confirmation
            </label>
            <input
              id="ag-confirmation"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="input-field"
              placeholder="Retape le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={envoi || mdp.length === 0}
            className="btn-primary w-full"
          >
            {envoi
              ? "Enregistrement…"
              : props.mode === "gerant"
                ? "Changer mon mot de passe"
                : "Mettre à jour le mot de passe"}
          </button>
        </form>
      )}
    </div>
  );
}
