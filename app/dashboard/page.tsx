"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function DashboardPage() {
  const [boutique, setBoutique] = useState<{name: string; slug: string; subscription_status: string} | null>(null);
  const [stats, setStats] = useState({ products: 0, orders: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("boutique_id").eq("id", user.id).single();
      if (!p?.boutique_id) return;
      const { data: b } = await supabase.from("boutiques").select("*").eq("id", p.boutique_id).single();
      setBoutique(b);
      const [{ count: pc }, { count: oc }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }).eq("boutique_id", p.boutique_id),
        supabase.from("orders").select("*", { count: "exact", head: true }).eq("boutique_id", p.boutique_id),
      ]);
      setStats({ products: pc || 0, orders: oc || 0 });
    };
    load();
  }, []);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const catalogUrl = boutique ? `${appUrl}/boutique/${boutique.slug}` : "";

  return (
    <div className="space-y-6">
      <h1 className="section-title">Tableau de bord</h1>
      {boutique && (
        <div className="card p-4 border-l-4 border-orange-500">
          <p className="text-sm font-semibold text-gray-700 mb-2">🔗 Ton lien catalogue</p>
          <div className="flex gap-2">
            <input readOnly value={catalogUrl} className="input-field text-sm bg-gray-50 flex-1" />
            <button onClick={() => { navigator.clipboard.writeText(catalogUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="btn-primary text-sm px-4">{copied ? "✓ Copié" : "Copier"}</button>
          </div>
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
        <Link href="/dashboard/produits/nouveau" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-xl">📦</div>
          <div><p className="font-semibold text-sm">Ajouter un produit</p><p className="text-xs text-gray-400">Photo, nom, prix</p></div>
        </Link>
        <Link href="/dashboard/commandes" className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">🛒</div>
          <div><p className="font-semibold text-sm">Voir les commandes</p><p className="text-xs text-gray-400">Gérer les livraisons</p></div>
        </Link>
      </div>
    </div>
  );
}
