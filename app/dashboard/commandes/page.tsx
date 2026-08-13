"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Order { id: string; order_number: string; customer_name: string; customer_phone: string; total_amount: number; status: string; created_at: string; items: {name: string; quantity: number; price: number}[]; }

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700", confirmed: "bg-orange-100 text-orange-700",
  processing: "bg-purple-100 text-purple-700", delivered: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = { new: "Nouvelle", confirmed: "Confirmée", processing: "En cours", delivered: "Livrée", cancelled: "Annulée" };

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("boutique_id").eq("id", user.id).single();
      if (!p?.boutique_id) { setLoading(false); return; }
      const { data } = await supabase.from("orders").select("*").eq("boutique_id", p.boutique_id).order("created_at", { ascending: false });
      setOrders(data || []);
      setLoading(false);
    };
    load();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("orders").update({ status }).eq("id", id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"/></div>;

  return (
    <div className="space-y-5">
      <h1 className="section-title">Commandes <span className="text-gray-400 text-lg">({orders.length})</span></h1>
      {orders.length === 0 ? (
        <div className="card p-12 text-center"><p className="text-4xl mb-3">🛒</p><p className="text-gray-500">Aucune commande pour l&apos;instant</p></div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{order.order_number}</span>
                    <span className={`badge ${STATUS_COLORS[order.status]}`}>{STATUS_LABELS[order.status]}</span>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="font-bold text-orange-500">{new Intl.NumberFormat("fr-FR").format(order.total_amount)} FCFA</span>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                <p className="font-semibold text-sm">👤 {order.customer_name}</p>
                <a href={`tel:${order.customer_phone}`} className="text-xs text-orange-500">📞 {order.customer_phone}</a>
              </div>
              <div className="mb-3 space-y-1">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.name} x{item.quantity}</span>
                    <span className="font-medium">{new Intl.NumberFormat("fr-FR").format(item.price * item.quantity)} FCFA</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)} className="input-field text-sm py-2 flex-1">
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <a href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, votre commande ${order.order_number} est ${STATUS_LABELS[order.status].toLowerCase()}.`)}`}
                  target="_blank" className="btn-whatsapp text-sm py-2 px-3">💬</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
