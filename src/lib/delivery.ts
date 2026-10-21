import { useEffect, useState } from "react";

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

type O = { status: string; delivery_status: string; deliver_after: string | null };

export type Tone = "success" | "warning" | "muted" | "primary";

export function deliveryState(o: O, now: number): { label: string; tone: Tone; step: number } {
  if (o.status === "cancelled") return { label: "Cancelado", tone: "muted", step: -1 };
  if (o.status === "pending") return { label: "Aguardando pagamento", tone: "warning", step: 0 };
  if (o.delivery_status === "awaiting_stock") return { label: "Aguardando estoque", tone: "warning", step: 1 };
  if (o.delivery_status === "delivered") {
    if (o.deliver_after && new Date(o.deliver_after).getTime() > now)
      return { label: "Em preparo", tone: "primary", step: 1 };
    return { label: "Entregue", tone: "success", step: 2 };
  }
  return { label: "Aguardando envio", tone: "primary", step: 1 };
}

export function countdown(iso: string | null, now: number) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h ${m}min` : `${m}min ${String(sec).padStart(2, "0")}s`;
}

export const toneClass: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  primary: "bg-primary/10 text-primary",
  muted: "bg-secondary text-muted-foreground",
};

export const steps = ["Pedido feito", "Pagamento confirmado", "Entregue"];
