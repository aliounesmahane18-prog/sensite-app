"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Boutique { id: string; name: string; slug: string; category: string; subscription_status: string; monthly_price: number; quartier: string | null; }

const STATUS_COLOR: Record<string, string> = { active: "bg-green-100 text-green-700", pending: "bg-orange-100 text-orange-700", suspended: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-500" };
const STATUS_LABEL: Record<string, string> = { active: "Actif", pending: "En attente", suspended: "Suspendu", cancelled: "Annulé" };

export default function AdminPage() {
  const router = useRouter();
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role !== "super_admin") { router.push("/dashboard"); return; }
      const { data } = await supabase.from("boutiques").select("*").order("created_at", { ascending: false });
      setBoutiques(data || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const toggleStatus = async (b: Boutique) => {
    const newStatus = b.subscription_status === "active" ? "suspended" : "active";
    const updates: Record<string, unknown> = { subscription_status: newStatus };
    if (newStatus === "active") {
      const end = new Date(); end.setMonth(end.getMonth() + 1);
      updates.subscription_start = new Date().toISOString().split("T")[0];
      updates.subscription_end = end.toISOString().split("T")[0];
    }
    await supabase.from("boutiques").update(updates).eq("id", b.id);
    setBoutiques(prev => prev.map(x => x.id === b.id ? { ...x, subscription_status: newStatus } : x));
  };

  const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>;

  const stats = { total: boutiques.length, active: boutiques.filter(b => b.subscription_status === "active").length, revenue: boutiques.filter(b => b.subscription_status === "active").reduce((s, b) => s + b.monthly_price, 0) };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-900 text-white px-4 h-14 flex items-center justify-between sticky top-0 z-30">
        <span className="font-bold">SENsite<span className="text-orange-500">APP</span> <span className="text-xs bg-orange-500 px-2 py-0.5 rounded-full ml-1">Admin</span></span>
        <div className="flex gap-3">
          <Link href="/admin/boutique/nouvelle" className="btn-primary text-xs py-1.5">+ Nouvelle boutique</Link>
          <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Déconnexion</button>
        </div>
      </nav>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <h1 className="section-title">Gestion des boutiques</h1>
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "Total", value: stats.total, color: "text-blue-600" }, { label: "Actives", value: stats.active, color: "text-green-600" }, { label: "Revenu/mois", value: `${new Intl.NumberFormat("fr-FR").format(stats.revenue)} FCFA`, color: "text-orange-600" }].map(s => (
            <div key={s.label} className="card p-4">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {boutiques.map(b => (
            <div key={b.id} className="card p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold shrink-0">{b.name.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{b.name}</span>
                  <span className={`badge ${STATUS_COLOR[b.subscription_status]}`}>{STATUS_LABEL[b.subscription_status]}</span>
                </div>
                <div className="text-xs text-gray-400 flex gap-3 flex-wrap mt-0.5">
                  {b.quartier && <span>📍 {b.quartier}</span>}
                  <span className="font-mono">/boutique/{b.slug}</span>
                  <span className="text-orange-500 font-semibold">{new Intl.NumberFormat("fr-FR").format(b.monthly_price)} FCFA/mois</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={`${process.env.NEXT_PUBLIC_APP_URL}/boutique/${b.slug}`} target="_blank" className="btn-secondary text-xs py-1.5 px-3">👁 Voir</a>
                <button onClick={() => toggleStatus(b)} className={`text-xs py-1.5 px-3 rounded-xl border transition-colors ${b.subscription_status === "active" ? "bg-red-50 text-red-600 border-red-200" : "btn-primary"}`}>
                  {b.subscription_status === "active" ? "Suspendre" : "✓ Activer"}
                </button>
              </div>
            </div>
          ))}
          {boutiques.length === 0 && <div className="card p-12 text-center"><p className="text-4xl mb-3">🏪</p><p className="text-gray-500">Aucune boutique créée</p></div>}
        </div>
      </div>
    </div>
  );
}
