"use client";
import { useCallback, useEffect, useState } from "react";
import { getAccessToken } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";
import { emailMasque, LONGUEUR_MOT_DE_PASSE_MIN } from "@/lib/gerant-partage";
import ChampsCompteGerant from "@/components/champs-compte-gerant";

interface Mode {
  /**
   * `prospecteur` : uniquement le mot de passe, et seulement sur ses propres
   * boutiques. `admin` : mot de passe ET adresse email, sur n'importe quelle
   * boutique.
   *
   * Le gérant lui-même n'a pas d'accès : ses identifiants sont gérés pour
   * lui.
   */
  mode: "prospecteur" | "admin";
  boutiqueId: string;
}

/**
 * Section « accès gérant » des paramètres boutique.
 *
 * Tout passe par une route serveur : modifier le compte d'un AUTRE
 * utilisateur exige la clé service role, qui ne doit jamais atteindre le
 * navigateur. Chaque route revérifie les droits de l'appelant.
 */
export default function AccesGerant({ mode, boutiqueId }: Mode) {
  const estAdmin = mode === "admin";
  const base = estAdmin
    ? `/api/admin/boutiques/${boutiqueId}/gerant`
    : `/api/prospecteur/boutiques/${boutiqueId}/gerant`;

  const [emailGerant, setEmailGerant] = useState<string | null>(null);
  const [nouvelEmailGerant, setNouvelEmailGerant] = useState("");
  const [chargement, setChargement] = useState(true);
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");

  // Création du compte quand la boutique n'en a pas encore.
  const [nouvelEmail, setNouvelEmail] = useState("");
  const [nouveauMdp, setNouveauMdp] = useState("");

  const charger = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(base, { headers: { Authorization: `Bearer ${token ?? ""}` } });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEmailGerant(json.gerant?.email ?? null);
      setNouvelEmailGerant(json.gerant?.email ?? "");
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setChargement(false);
    }
  }, [base]);

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
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ email: nouvelEmail.trim(), password: nouveauMdp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEmailGerant(json.gerant.email);
      setNouvelEmailGerant(json.gerant.email);
      setNouvelEmail("");
      setNouveauMdp("");
      setSucces("Compte gérant créé ✅ — transmets les identifiants au gérant.");
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  const emailChange = estAdmin && nouvelEmailGerant.trim().toLowerCase() !== (emailGerant ?? "").toLowerCase();

  const mettreAJour = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur("");
    setSucces("");

    // Le mot de passe est facultatif côté admin : il peut ne changer que
    // l'adresse. Côté prospecteur, c'est le seul champ, donc obligatoire.
    if (mdp || !estAdmin) {
      if (mdp.length < LONGUEUR_MOT_DE_PASSE_MIN) {
        setErreur(`Le mot de passe doit contenir au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères`);
        return;
      }
      if (mdp !== confirmation) {
        setErreur("Les deux mots de passe ne sont pas identiques.");
        return;
      }
    }
    if (!mdp && !emailChange) {
      setErreur("Rien à modifier.");
      return;
    }

    setEnvoi(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(base, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          ...(mdp ? { password: mdp } : {}),
          ...(emailChange ? { email: nouvelEmailGerant.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (json.email) {
        setEmailGerant(json.email);
        setNouvelEmailGerant(json.email);
      }
      setMdp("");
      setConfirmation("");
      setSucces(
        mdp && emailChange ? "Email et mot de passe mis à jour ✅"
          : mdp ? "Mot de passe mis à jour ✅"
          : "Email mis à jour ✅",
      );
    } catch (err) {
      setErreur(getErrorMessage(err));
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="card p-4 space-y-4">
      <h2 className="font-bold text-gray-900">🔐 Accès gérant</h2>

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
        <form onSubmit={mettreAJour} className="space-y-4">
          {estAdmin ? (
            <div>
              <label className="label" htmlFor="ag-email-gerant">Email du gérant</label>
              <input
                id="ag-email-gerant"
                type="email"
                value={nouvelEmailGerant}
                onChange={(e) => setNouvelEmailGerant(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-gray-400 mt-1">
                C&apos;est son identifiant de connexion : le modifier change la façon dont
                il se connecte.
              </p>
            </div>
          ) : (
            <div>
              <span className="label">Email du gérant</span>
              <p className="input-field bg-gray-50 text-gray-600">{emailMasque(emailGerant)}</p>
              <p className="text-xs text-gray-400 mt-1">
                Masqué volontairement. Seul l&apos;administrateur peut changer l&apos;adresse.
              </p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="ag-nouveau">
              Nouveau mot de passe{estAdmin && <span className="text-gray-400 font-normal"> (optionnel)</span>}
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
            disabled={envoi || (mdp.length === 0 && !emailChange)}
            className="btn-primary w-full"
          >
            {envoi
              ? "Enregistrement…"
              : estAdmin
                ? "Mettre à jour l'accès"
                : "Mettre à jour le mot de passe"}
          </button>
        </form>
      )}
    </div>
  );
}
