import { cn } from "@/lib/utils";
import { countdown, deliveryState, steps, toneClass } from "@/lib/delivery";

type O = { status: string; delivery_status: string; deliver_after: string | null };

export function StatusBadge({ order, now }: { order: O; now: number }) {
  const s = deliveryState(order, now);
  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", toneClass[s.tone])}>{s.label}</span>;
}

export function OrderTracker({ order, now }: { order: O; now: number }) {
  const s = deliveryState(order, now);
  const left = countdown(order.deliver_after, now);
  if (s.step < 0) return null;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {steps.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1">
            <div className={cn("h-1.5 rounded-full", i <= s.step ? "bg-primary" : "bg-border")} />
            <span className={cn("text-[11px]", i <= s.step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </div>
        ))}
      </div>
      {order.status === "paid" && order.deliver_after && (
        <p className="mt-2 text-xs text-muted-foreground">
          Prazo: {new Date(order.deliver_after).toLocaleString("pt-BR")}
          {left ? ` · faltam ${left}` : " · prazo concluído"}
        </p>
      )}
    </div>
  );
}
