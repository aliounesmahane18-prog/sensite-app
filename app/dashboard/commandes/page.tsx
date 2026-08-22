"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { formatFcfa } from "@/lib/utils";
import { ErrorBanner } from "@/components/config-error";
import { useCommandes, type Commande } from "@/lib/use-commandes";
import {
  dateLisible,
  FILTRES,
  infoStatut,
  resumeProduits,
  type StatutCommande,
} from "@/lib/commandes";
import ModaleCommandeManuelle from "@/components/modale-commande-manuelle";

export default function CommandesPage() {
  const router = useRouter();
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<StatutCommande | "toutes">("toutes");
  const [detail, setDetail] = useState<Commande | null>(null);
  const [modaleManuelle, setModaleManuelle] = useState(false);
  const [prete, setPrete] = useState(false);

  const { commandes, setCommandes, enAttente, chargement, erreur, setErreur } = useCommandes(
    boutiqueId,
    nouvelle => notifier(nouvelle),
  );

  useEffect(() => {
    const init = async () => {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profil } = await supabase
        .from("profiles").select("boutique_id").eq("id", user.id).single();
      if (profil?.boutique_id) setBoutiqueId(profil.boutique_id);
      setPrete(true);
    };
    init();
  }, [router]);

  // La permission est demandée au chargement : la demander au moment où la
  // commande arrive ferait rater la première notification.
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission().catch(() => undefined);
  }, []);

  const visibles = useMemo(
    () => (filtre === "toutes" ? commandes : commandes.filter(c => c.status === filtre)),
    [commandes, filtre],
  );

  const changerStatut = async (commande: Commande, statut: StatutCommande) => {
    const avant = commande.status;
    // Affichage immédiat : le gérant enchaîne les commandes, attendre le
    // serveur à chaque clic rendrait la liste poussive.
    setCommandes(prev => prev.map(c => (c.id === commande.id ? { ...c, status: statut } : c)));
    setDetail(d => (d && d.id === commande.id ? { ...d, status: statut } : d));

    const { data, error } = await getSupabase()
      .from("orders")
      .update({ status: statut })
      .eq("id", commande.id)
      .select("id")
      .maybeSingle();

    // Un UPDATE bloqué par RLS ne lève pas d'erreur : il ne touche aucune
    // ligne. Sans ce test, l'écran afficherait un statut jamais enregistré.
    if (error || !data) {
      setCommandes(prev => prev.map(c => (c.id === commande.id ? { ...c, status: avant } : c)));
      setDetail(d => (d && d.id === commande.id ? { ...d, status: avant } : d));
      setErreur(error?.message ?? "Changement refusé : droits insuffisants sur cette commande.");
    }
  };

  if (!prete || chargement) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🛒 Commandes</h1>
          <p className="text-sm text-gray-500">
            {commandes.length} au total
            {enAttente > 0 && <span className="text-orange-600 font-semibold"> — {enAttente} en attente</span>}
          </p>
        </div>
        <button onClick={() => setModaleManuelle(true)} className="btn-primary text-sm shrink-0">
          ＋ Ajouter une commande
        </button>
      </div>

      {erreur && <ErrorBanner message={erreur} />}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTRES.map(({ cle, label }) => {
          const n = cle === "toutes" ? commandes.length : commandes.filter(c => c.status === cle).length;
          const alerte = cle === "new" && enAttente > 0;
          return (
            <button
              key={cle}
              onClick={() => setFiltre(cle)}
              className={`relative px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                filtre === cle
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {label} ({n})
              {alerte && filtre !== cle && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  {/* Le halo ne tourne que s'il reste des commandes à traiter. */}
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-gray-500">
            {commandes.length === 0 ? "Aucune commande pour l'instant" : "Aucune commande dans ce filtre"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibles.map(c => {
            const info = infoStatut(c.status);
            return (
              <div key={c.id} className="card p-4 space-y-3">
                <div
                  onClick={() => setDetail(c)}
                  className="cursor-pointer space-y-1"
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && setDetail(c)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400">{dateLisible(c.created_at)}</span>
                    <span className={`badge ${c.source === "manuelle" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
                      {c.source === "manuelle" ? "Manuelle ✏️" : "WhatsApp 💬"}
                    </span>
                    <span className={`badge ${info.badge}`}>{info.puce} {info.label}</span>
                    <span className="ml-auto font-bold text-orange-500">{formatFcfa(c.total_amount)}</span>
                  </div>
                  <p className="text-sm text-gray-800">{resumeProduits(c.items)}</p>
                  {c.customer_name && (
                    <p className="text-xs text-gray-500">👤 {c.customer_name}</p>
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {info.suivant && (
                    <button
                      onClick={() => changerStatut(c, info.suivant as StatutCommande)}
                      className="btn-primary text-xs py-1.5"
                    >
                      {info.labelSuivant}
                    </button>
                  )}
                  {c.status !== "cancelled" && c.status !== "paid" && (
                    <button
                      onClick={() => changerStatut(c, "cancelled")}
                      className="btn-secondary text-xs py-1.5 text-red-500"
                    >
                      Annuler
                    </button>
                  )}
                  <button onClick={() => setDetail(c)} className="btn-secondary text-xs py-1.5 ml-auto">
                    Détail
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail && (
        <DetailCommande
          commande={detail}
          onFermer={() => setDetail(null)}
          onStatut={statut => changerStatut(detail, statut)}
        />
      )}

      {modaleManuelle && boutiqueId && (
        <ModaleCommandeManuelle
          boutiqueId={boutiqueId}
          onFermer={() => setModaleManuelle(false)}
          onCreee={c => setCommandes(prev => (prev.some(x => x.id === c.id) ? prev : [c, ...prev]))}
        />
      )}
    </div>
  );

  function notifier(c: Commande) {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      new Notification("🛒 Nouvelle commande reçue !", {
        body: `${formatFcfa(c.total_amount)} — ${resumeProduits(c.items)}`,
        tag: c.id,
      });
    } catch {
      // Certains navigateurs mobiles n'autorisent les notifications que via un
      // service worker : l'absence de notification ne doit rien casser.
    }
  }
}

function DetailCommande({
  commande,
  onFermer,
  onStatut,
}: {
  commande: Commande;
  onFermer: () => void;
  onStatut: (s: StatutCommande) => void;
}) {
  const info = infoStatut(commande.status);
  const tel = (commande.customer_phone ?? "").replace(/\D/g, "");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-lg">Commande {commande.order_number}</h2>
            <p className="text-xs text-gray-500">{dateLisible(commande.created_at)}</p>
          </div>
          <button onClick={onFermer} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span className={`badge ${info.badge}`}>{info.puce} {info.label}</span>
          <span className={`badge ${commande.source === "manuelle" ? "bg-gray-100 text-gray-600" : "bg-green-100 text-green-700"}`}>
            {commande.source === "manuelle" ? "Manuelle ✏️" : "WhatsApp 💬"}
          </span>
        </div>

        <div className="border border-gray-100 rounded-xl divide-y divide-gray-50">
          {(commande.items ?? []).map((i, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{i.name}</p>
                <p className="text-xs text-gray-400">{formatFcfa(i.price)} × {i.quantity}</p>
              </div>
              <span className="font-semibold shrink-0">{formatFcfa(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between p-3 font-bold">
            <span>Total</span>
            <span className="text-orange-500">{formatFcfa(commande.total_amount)}</span>
          </div>
        </div>

        {(commande.customer_name || commande.customer_phone || commande.customer_address) && (
          <div className="text-sm space-y-1">
            {commande.customer_name && <p>👤 {commande.customer_name}</p>}
            {commande.customer_phone && <p>📞 {commande.customer_phone}</p>}
            {commande.customer_address && <p>📍 {commande.customer_address}</p>}
          </div>
        )}

        {commande.notes && (
          <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">📝 {commande.notes}</div>
        )}

        <p className="text-xs text-gray-400">
          Dernière modification : {dateLisible(commande.updated_at)}
        </p>

        <div className="flex gap-2 flex-wrap pt-1">
          {info.suivant && (
            <button onClick={() => onStatut(info.suivant as StatutCommande)} className="btn-primary flex-1 text-sm">
              {info.labelSuivant}
            </button>
          )}
          {tel && (
            <a
              href={`https://wa.me/${tel}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp text-sm"
            >
              💬 Contacter
            </a>
          )}
          {commande.status !== "cancelled" && commande.status !== "paid" && (
            <button onClick={() => onStatut("cancelled")} className="btn-secondary text-sm text-red-500">
              Annuler
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
