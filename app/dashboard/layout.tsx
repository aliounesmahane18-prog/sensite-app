"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { getSupabase, SupabaseConfigError } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ConfigError } from "@/components/config-error";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: "🏠", short: "Accueil" },
  { href: "/dashboard/produits", label: "Mes produits", icon: "📦", short: "Produits" },
  { href: "/dashboard/commandes", label: "Commandes", icon: "🛒", short: "Commandes" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<"checking" | "ready" | "unconfigured">("checking");

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!isSupabaseConfigured()) {
        setState("unconfigured");
        return;
      }
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile) {
          router.replace("/login");
          return;
        }
        if (profile.role === "super_admin") {
          router.replace("/admin");
          return;
        }
        setState("ready");
      } catch (err) {
        if (cancelled) return;
        // Une panne réseau ne doit pas bloquer l'accès : seules les erreurs de
        // configuration justifient l'écran dédié, les pages enfants gèrent le reste.
        if (err instanceof SupabaseConfigError) setState("unconfigured");
        else setState("ready");
      }
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const logout = async () => {
    try {
      await getSupabase().auth.signOut();
    } finally {
      router.replace("/login");
    }
  };

  if (state === "unconfigured") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <ConfigError />
      </div>
    );
  }

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname?.startsWith(href);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-100 flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link href="/" className="font-bold text-lg">
            SENsite<span className="text-orange-500">APP</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.href) ? "bg-orange-50 text-orange-500" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-red-500 px-3 py-2 w-full text-left"
          >
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre mobile : sans elle, un gérant sur téléphone n'a aucun moyen
            de naviguer ni de se déconnecter. */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-gray-100 h-14 px-4 flex items-center justify-between">
          <Link href="/" className="font-bold">
            SENsite<span className="text-orange-500">APP</span>
          </Link>
          <button onClick={logout} className="text-sm text-gray-400">
            🚪 Déconnexion
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6">{children}</main>

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 grid grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`py-2.5 text-center text-xs font-medium ${
                isActive(item.href) ? "text-orange-500" : "text-gray-500"
              }`}
            >
              <span className="block text-lg leading-tight">{item.icon}</span>
              {item.short}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
