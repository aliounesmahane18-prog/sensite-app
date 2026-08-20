"use client";
import { useEffect, useRef, useState } from "react";
import { SECTEURS } from "@/lib/secteurs";
import { contactWhatsapp, numeroWhatsapp } from "@/lib/whatsapp";

const CLE_STOCKAGE = "sensite_contacts_envoyes";
const DUREE_CONFIRMATION_MS = 4000;

/**
 * Numéros déjà utilisés depuis ce navigateur.
 *
 * Tout est protégé : `localStorage` lève une exception en navigation privée
 * sur certains navigateurs, et la valeur stockée peut avoir été corrompue à
 * la main. Dans le doute on renvoie une liste vide — mieux vaut laisser
 * passer un doublon que casser le formulaire.
 */
function numerosEnvoyes(): string[] {
  try {
    const brut = window.localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return [];
    const valeur: unknown = JSON.parse(brut);
    return Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function memoriserNumero(numero: string): void {
  try {
    const deja = numerosEnvoyes();
    if (deja.includes(numero)) return;
    window.localStorage.setItem(CLE_STOCKAGE, JSON.stringify([...deja, numero]));
  } catch {
    // Stockage indisponible : l'anti-doublon ne fonctionnera pas, mais la
    // demande, elle, est bien partie. Rien à signaler au visiteur.
  }
}

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
  const [dejaUtilise, setDejaUtilise] = useState(false);
  const [vientDEnvoyer, setVientDEnvoyer] = useState(false);
  const [confirme, setConfirme] = useState(false);
  const minuterie = useRef<number | null>(null);

  // Le composant peut disparaître avant la fin des 4 secondes.
  useEffect(() => () => {
    if (minuterie.current !== null) window.clearTimeout(minuterie.current);
  }, []);

  /**
   * Vérification du doublon à chaque frappe.
   *
   * Dans un effet et non pendant le rendu : `localStorage` n'existe pas sur
   * le serveur, et le lire au rendu ferait diverger le HTML serveur du
   * premier rendu navigateur (erreur d'hydratation). L'effet ne s'exécute
   * que côté navigateur, après le rendu initial.
   */
  useEffect(() => {
    const cle = numeroWhatsapp(tel);
    setDejaUtilise(cle.length > 0 && numerosEnvoyes().includes(cle));
  }, [tel]);

  const numero = contactWhatsapp(numeroContact);
  const complet = nom.trim().length > 1 && tel.trim().length > 5;

  /**
   * Demande déjà partie : soit le numéro saisi figure dans le stockage, soit
   * l'envoi vient d'avoir lieu (le formulaire est alors vide, donc le premier
   * test ne suffirait pas). Reprendre la main se fait en saisissant un autre
   * numéro.
   */
  const bloque = dejaUtilise || vientDEnvoyer;

  const envoyer = () => {
    // 1. Champs obligatoires
    if (!complet) return;

    // 2. On compare des chiffres, pas du texte : « 77 123 45 67 » et
    //    « 771234567 » sont le même numéro, et sans cette normalisation
    //    l'anti-doublon se contournerait avec une espace.
    const cle = numeroWhatsapp(tel);

    // 3. et 4. Doublon : le bouton est déjà désactivé dans ce cas, ce test
    //    reste la dernière barrière (clic au clavier, état non encore
    //    recalculé, stockage modifié dans un autre onglet).
    if (numerosEnvoyes().includes(cle)) {
      setDejaUtilise(true);
      setConfirme(false);
      return;
    }

    // 5. Le lien est construit AVANT la remise à zéro : après, les champs
    //    sont vides.
    const libelle = SECTEURS.find(([c]) => c === secteur)?.[1] ?? secteur;
    const message = `Bonjour, je souhaite ouvrir ma boutique sur SENsite-APP. Nom: ${nom.trim()}, Téléphone: ${tel.trim()}, Secteur: ${libelle}`;
    const lien = `https://wa.me/${numero}?text=${encodeURIComponent(message)}`;

    // 6. Mémorisation
    memoriserNumero(cle);

    // 7. et 8. Remise à zéro et confirmation AVANT l'ouverture de WhatsApp :
    //    sur mobile, `window.open` bascule vers l'application et peut
    //    suspendre la page avant que React ait eu le temps de re-rendre.
    setNom("");
    setTel("");
    setSecteur(SECTEURS[0][0]);
    setVientDEnvoyer(true);
    setConfirme(true);

    // 9. Ouvert depuis le clic : c'est ce qui autorise le navigateur à ne
    //    pas bloquer l'onglet.
    window.open(lien, "_blank", "noopener,noreferrer");

    // 10. La confirmation s'efface d'elle-même.
    if (minuterie.current !== null) window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setConfirme(false), DUREE_CONFIRMATION_MS);
  };

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
              // Saisir un numéro rend la main : l'état « vient d'envoyer »
              // concernait la demande précédente. Le doublon, lui, est
              // recalculé par l'effet à chaque frappe.
              onChange={(e) => { setTel(e.target.value); setVientDEnvoyer(false); }}
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

          {/* Un bouton, plus un lien : il y a des vérifications à faire avant
              d'ouvrir WhatsApp, et le formulaire doit être vidé ensuite.
              Trois états : gris et verrouillé si la demande est déjà partie,
              vert atténué tant que le formulaire est incomplet, vert franc
              quand il est prêt. */}
          <button
            type="button"
            onClick={envoyer}
            disabled={bloque || !complet}
            // Tout passe par des classes, sans style inline : bg-gray-400
            // vaut exactement #9ca3af et opacity-70 exactement 0.7.
            // Le changement de couleur suit la transition de .btn-whatsapp
            // (150 ms), il n'est donc pas instantané à l'œil.
            className={
              bloque
                ? "w-full text-center font-bold px-5 py-3 rounded-2xl text-white bg-gray-400 opacity-70 cursor-not-allowed"
                : `btn-whatsapp w-full text-center ${complet ? "" : "opacity-50 cursor-not-allowed"}`
            }
          >
            {bloque ? "Demande déjà envoyée ✓" : "💬 Nous contacter sur WhatsApp"}
          </button>

          {/* Le bouton étant verrouillé, le visiteur ne peut plus cliquer pour
              comprendre pourquoi : le message doit apparaître de lui-même. */}
          {dejaUtilise && (
            <p
              role="status"
              className="text-sm text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3"
            >
              Vous avez déjà envoyé une demande avec ce numéro. Nous vous
              recontacterons bientôt. 😊
            </p>
          )}

          {confirme && (
            <p
              role="status"
              className="text-sm text-center text-green-700 bg-green-50 border border-green-200 rounded-xl p-3"
            >
              ✅ Demande envoyée ! Nous vous répondrons très vite sur WhatsApp.
            </p>
          )}

          {/* Masqué pendant la confirmation : le formulaire vient d'être vidé,
              rappeler de le remplir juste après un envoi réussi est absurde. */}
          {!complet && !confirme && !bloque && (
            <p className="text-xs text-gray-400 text-center">
              Renseigne ton nom et ton téléphone pour continuer.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
