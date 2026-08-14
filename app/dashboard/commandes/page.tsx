"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { getSessionProfile } from "@/lib/session";
import { ErrorBanner } from "@/components/config-error";
import { formatFcfa, getErrorMessage } from "@/lib/utils";
import type { Order, OrderItem, OrderStatus } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  confirmed: "bg-orange-100 text-orange-700",
  processing: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  confirmed: "Confirmée",
  processing: "En cours",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export default function CommandesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getSessionProfile();
        if (cancelled) return;
        if (!profile?.boutique_id) {
          setError("Ton compte n'est rattaché à aucune boutique. Contacte Ali.IA Solutions.");
          return;
        }

        const { data, error: queryError } = await getSupabase()
          .from("orders")
          .select("*")
          .eq("boutique_id", profile.boutique_id)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (queryError) throw new Error(queryError.message);
        setOrders(data ?? []);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateStatus = async (id: string, status: OrderStatus) => {
    const { error: updateError } = await getSupabase().from("orders").update({ status }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="section-title">
        Commandes <span className="text-gray-400 text-lg">({orders.length})</span>
      </h1>

      {error && <ErrorBanner message={error} />}

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">🛒</p>
          <p className="text-gray-500">Aucune commande pour l&apos;instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
            const statusLabel = STATUS_LABELS[order.status] ?? order.status;
            const whatsappNumber = order.customer_phone.replace(/\D/g, "");
            const whatsappText = encodeURIComponent(
              `Bonjour ${order.customer_name}, votre commande ${order.order_number} est ${statusLabel.toLowerCase()}.`,
            );

            return (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{order.order_number}</span>
                      <span className={`badge ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="font-bold text-orange-500 shrink-0">{formatFcfa(order.total_amount)}</span>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <p className="font-semibold text-sm">👤 {order.customer_name}</p>
                  <a href={`tel:${order.customer_phone}`} className="text-xs text-orange-500">
                    📞 {order.customer_phone}
                  </a>
                  {order.customer_address && (
                    <p className="text-xs text-gray-500 mt-0.5">📍 {order.customer_address}</p>
                  )}
                </div>

                <div className="mb-3 space-y-1">
                  {items.map((item, index) => (
                    <div key={`${item.product_id}-${index}`} className="flex justify-between text-sm gap-3">
                      <span className="text-gray-600">
                        {item.name} x{item.quantity}
                      </span>
                      <span className="font-medium shrink-0">{formatFcfa(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <label className="sr-only" htmlFor={`status-${order.id}`}>
                    Statut de la commande {order.order_number}
                  </label>
                  <select
                    id={`status-${order.id}`}
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}
                    className="input-field text-sm py-2 flex-1"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <a
                    href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-whatsapp text-sm py-2 px-3"
                  >
                    💬
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
