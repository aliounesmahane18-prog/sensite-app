"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (p?.role === "super_admin") { router.push("/admin"); return; }
      setLoading(false);
    };
    check();
  }, [router]);

  const logout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>;

  const navItems = [
    { href: "/dashboard", label: "🏠 Tableau de bord" },
    { href: "/dashboard/produits", label: "📦 Mes produits" },
    { href: "/dashboard/commandes", label: "🛒 Commandes" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="hidden lg:flex w-56 bg-white border-r border-gray-100 flex-col">
        <div className="p-4 border-b border-gray-100">
          <Link href="/" className="font-bold text-lg">SENsite<span className="text-orange-500">APP</span></Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === item.href ? "bg-orange-50 text-orange-500" : "text-gray-600 hover:bg-gray-50"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-500 px-3 py-2 w-full text-left">
            🚪 Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
