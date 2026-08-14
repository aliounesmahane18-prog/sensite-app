"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { catalogueUrl } from "@/lib/env";
import { ErrorBanner } from "@/components/config-error";
import { formatFcfa, getErrorMessage } from "@/lib/utils";

interface BoutiqueSummary {
  name: string;
  slug: string;
  subscription_status: string;
  monthly_price: number;
}

const STATUS_HINT: Record<string, { label: string; className: string }> = {
  active: { label: "Abonnement actif", className: "bg-green-100 text-green-700" },
  pending: { label: "En attente d'activation", className: "bg-orange-100 text-orange-700" },
  suspended: { label: "Abonnement suspendu", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Abonnement annulé", className: "bg-gray-100 text-gray-500" },
};

export default function DashboardPage() {
  const [boutique, setBoutique] = useState<BoutiqueSummary | null>(null);
  const [stats, setStats] = useState({ products: 0, orders: 0 });
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled || !profile) return;
        if (!profile.boutique_id) {
          setError("Ton compte n'est rattaché à aucune boutique. Contacte Ali.IA Solutions.");
          return;
        }

        const supabase = getSupabase();
        const { data: b } = await supabase
          .from("boutiques")
          .select("name, slug, subscription_status, monthly_price")
          .eq("id", profile.boutique_id)
          .maybeSingle();
        if (cancelled) return;
        setBoutique(b);

        const [{ count: productCount }, { count: orderCount }] = await Promise.all([
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("boutique_id", profile.boutique_id),
          supabase
            .from("orders")
            .select("*", { count: "exact", head: true })
            .eq("boutique_id", profile.boutique_id),
        ]);
        if (cancelled) return;
        setStats({ products: productCount ?? 0, orders: orderCount ?? 0 });
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const url = boutique ? catalogueUrl(boutique.slug) : "";
  const status = boutique ? STATUS_HINT[boutique.subscription_status] : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible sur ce navigateur, sélectionne le lien à la main.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="section-title">Tableau de bord</h1>
      {error && <ErrorBanner message={error} />}

      {boutique && (
        <div className="card p-4 border-l-4 border-orange-500 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-700">🔗 Ton lien catalogue</p>
            {status && <span className={`badge ${status.className}`}>{status.label}</span>}
          </div>
          <div className="flex gap-2">
            <input readOnly value={url} className="input-field text-sm bg-gray-50 flex-1 min-w-0" />
            <button onClick={copy} className="btn-primary text-sm px-4 shrink-0">
              {copied ? "✓ Copié" : "Copier"}
            </button>
          </div>
          {boutique.subscription_status !== "active" && (
            <p className="text-xs text-gray-500">
              Ton catalogue reste invisible pour les clients tant que l&apos;abonnement
              ({formatFcfa(boutique.monthly_price)}/mois) n&apos;est pas activé par Ali.IA Solutions.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/dashboard/produits" className="card p-4 hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-orange-500">{stats.products}</p>
          <p className="text-gray-500 text-sm">Produits</p>
        </Link>
        <Link href="/dashboard/commandes" className="card p-4 hover:shadow-md transition-shadow">
          <p className="text-3xl font-bold text-green-500">{stats.orders}</p>
          <p className="text-gray-500 text-sm">Commandes</p>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          href="/dashboard/produits/nouveau"
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-xl">📦</div>
          <div>
            <p className="font-semibold text-sm">Ajouter un produit</p>
            <p className="text-xs text-gray-400">Photo, nom, prix</p>
          </div>
        </Link>
        <Link
          href="/dashboard/commandes"
          className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">🛒</div>
          <div>
            <p className="font-semibold text-sm">Voir les commandes</p>
            <p className="text-xs text-gray-400">Gérer les livraisons</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
