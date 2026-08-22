"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getSupabase } from "@/lib/supabase";
import { useCommandesEnAttente } from "@/lib/use-commandes";
import LogoSensite from "@/components/logo-sensite";

interface Boutique {
  name: string;
  slug: string;
  subscription_status: string;
  logo_url: string | null;
  color_primary: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [boutique, setBoutique] = useState<Boutique | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [boutiqueId, setBoutiqueId] = useState<string | null>(null);
  const commandesEnAttente = useCommandesEnAttente(boutiqueId);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await getSupabase().auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await getSupabase().from("profiles").select("role, boutique_id").eq("id", user.id).single();
      if (p?.role === "super_admin") { router.push("/admin"); return; }
      if (p?.boutique_id) {
        setBoutiqueId(p.boutique_id);
        const { data: b } = await getSupabase().from("boutiques").select("name, slug, subscription_status, logo_url, color_primary").eq("id", p.boutique_id).single();
        setBoutique(b);
      }
      setLoading(false);
    };
    check();
  }, [router]);

  const logout = async () => { await getSupabase().auth.signOut(); router.push("/login"); };

  const navItems = [
    { href: "/dashboard", label: "🏠 Tableau de bord" },
    { href: "/dashboard/produits", label: "📦 Mes produits" },
    { href: "/dashboard/commandes", label: "🛒 Commandes", badge: commandesEnAttente },
    { href: "/dashboard/parametres", label: "⚙️ Paramètres" },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
    </div>
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const catalogUrl = boutique ? `${appUrl}/boutique/${boutique.slug}` : "";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex-col
        ${sidebarOpen ? "flex" : "hidden"} lg:flex`}>
        <div className="p-4 border-b border-gray-100">
          <LogoSensite hauteur={32} classeTexte="text-lg" />
        </div>

        {/* Info boutique */}
        {boutique && (
          <div className="p-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {boutique.logo_url ? (
                // `contain` sur fond neutre : le logo n'est pas rogné.
                <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-gray-100 shrink-0"
                  style={{ background: "#f5f5f5" }}>
                  <Image src={boutique.logo_url} alt={boutique.name} fill sizes="36px"
                    className="object-contain" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: boutique.color_primary }}>
                  {boutique.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{boutique.name}</p>
                <span className={`text-xs ${boutique.subscription_status === "active" ? "text-green-500" : "text-orange-500"}`}>
                  {boutique.subscription_status === "active" ? "✓ Actif" : "⏳ En attente"}
                </span>
              </div>
            </div>
            {catalogUrl && (
              <a href={catalogUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-orange-500 hover:underline mt-2 block truncate">
                🔗 Voir mon catalogue
              </a>
            )}
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === item.href ? "bg-orange-50 text-orange-500" : "text-gray-600 hover:bg-gray-50"
              }`}>
              <span>{item.label}</span>
              {/* Pastille des commandes non traitées, mise à jour en direct. */}
              {typeof item.badge === "number" && item.badge > 0 && (
                <span className="relative flex items-center justify-center shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button onClick={logout}
            className="text-sm text-gray-400 hover:text-red-500 px-3 py-2 w-full text-left transition-colors">
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-56 flex flex-col min-h-screen">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-2xl">☰</button>
          <LogoSensite hauteur={28} classeTexte="text-sm" href={null} />
          <div className="w-8" />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
