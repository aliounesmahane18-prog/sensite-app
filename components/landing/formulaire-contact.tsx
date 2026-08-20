"use client";
import { useState } from "react";
import { SECTEURS } from "@/lib/secteurs";
import { contactWhatsapp } from "@/lib/whatsapp";

interface Props {
  /**
   * Numéro de contact, transmis par le composant serveur.
   *
   * Il n'est volontairement pas lu ici via `process.env` : une variable
   * `NEXT_PUBLIC_*` marquée « Sensitive » dans Vercel n'est pas disponible au
   * build, et le bundle navigateur recevrait `undefined`. Passer la valeur en
   * prop la fait résoudre à chaque requête, côté serveur.
   *
   * Si elle est vide, `contactWhatsapp()` retombe sur le numéro en dur : le
   * bouton reste fonctionnel sur un déploiement non configuré.
   */
  numeroContact: string;
}

export default function FormulaireContact({ numeroContact }: Props) {
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [secteur, setSecteur] = useState<string>(SECTEURS[0][0]);

  const numero = contactWhatsapp(numeroContact);
  const complet = nom.trim().length > 1 && tel.trim().length > 5;

  const libelle = SECTEURS.find(([cle]) => cle === secteur)?.[1] ?? secteur;
  const message = `Bonjour, je souhaite ouvrir ma boutique sur SENsite-APP. Nom: ${nom.trim()}, Téléphone: ${tel.trim()}, Secteur: ${libelle}`;
  const lien = `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;

  return (
    <section id="contact" className="scroll-mt-16 py-14 bg-white">
      <div className="max-w-xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-gray-900 text-center">Ouvrez votre boutique en ligne</h2>
        <p className="text-gray-500 text-center mt-2">
          Rejoignez nos boutiques partenaires et vendez via WhatsApp
        </p>

        <div className="card p-5 mt-8 space-y-4">
          <div>
            <label htmlFor="contact-nom" className="label">
              Nom complet
            </label>
            <input
              id="contact-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Aïssatou Diop"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="contact-tel" className="label">
              Téléphone
            </label>
            <input
              id="contact-tel"
              type="tel"
              inputMode="tel"
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              placeholder="77 123 45 67"
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="contact-secteur" className="label">
              Secteur d&apos;activité
            </label>
            <select
              id="contact-secteur"
              value={secteur}
              onChange={(e) => setSecteur(e.target.value)}
              className="input-field"
            >
              {SECTEURS.map(([cle, label]) => (
                <option key={cle} value={cle}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Plus de branche « numéro non configuré » : le numéro est
              toujours résolu, variable d'environnement ou valeur par défaut. */}
          <a
            href={complet ? lien : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!complet}
            onClick={(e) => {
              if (!complet) e.preventDefault();
            }}
            className={`btn-whatsapp w-full text-center ${
              complet ? "" : "opacity-50 cursor-not-allowed"
            }`}
          >
            💬 Nous contacter sur WhatsApp
          </a>

          {!complet && (
            <p className="text-xs text-gray-400 text-center">
              Renseigne ton nom et ton téléphone pour continuer.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
