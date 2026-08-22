"use client";
import { useState } from "react";
import { LONGUEUR_MOT_DE_PASSE_MIN } from "@/lib/gerant-partage";

interface Props {
  email: string;
  motDePasse: string;
  onEmail: (v: string) => void;
  onMotDePasse: (v: string) => void;
  /** Préfixe des `id` : deux formulaires peuvent coexister dans la page. */
  prefixe?: string;
}

/**
 * Bloc « Compte d'accès gérant » des formulaires de création de boutique.
 *
 * Partagé entre l'espace admin et l'espace prospecteur : les règles (email
 * obligatoire, mot de passe d'au moins 8 caractères) doivent être identiques
 * des deux côtés, et le serveur applique exactement les mêmes.
 */
export default function ChampsCompteGerant({
  email,
  motDePasse,
  onEmail,
  onMotDePasse,
  prefixe = "g",
}: Props) {
  const [visible, setVisible] = useState(false);
  const tropCourt = motDePasse.length > 0 && motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN;

  return (
    <div className="border-t border-gray-100 pt-4 space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">🔐 Compte d&apos;accès gérant</h3>
        <p className="text-xs text-gray-500 mt-1">
          Ces identifiants permettront au gérant de se connecter et gérer sa boutique.
        </p>
      </div>

      <div>
        <label className="label" htmlFor={`${prefixe}-email`}>
          Email du gérant *
        </label>
        <input
          id={`${prefixe}-email`}
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          className="input-field"
          placeholder="gerant@boutique.com"
        />
      </div>

      <div>
        <label className="label" htmlFor={`${prefixe}-mdp`}>
          Mot de passe *
        </label>
        <div className="relative">
          <input
            id={`${prefixe}-mdp`}
            type={visible ? "text" : "password"}
            required
            minLength={LONGUEUR_MOT_DE_PASSE_MIN}
            autoComplete="new-password"
            value={motDePasse}
            onChange={(e) => onMotDePasse(e.target.value)}
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
        {tropCourt && (
          <p className="text-xs text-red-500 mt-1">
            Le mot de passe doit contenir au moins {LONGUEUR_MOT_DE_PASSE_MIN} caractères.
          </p>
        )}
      </div>
    </div>
  );
}
