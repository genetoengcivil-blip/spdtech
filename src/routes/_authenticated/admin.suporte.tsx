import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNow } from "@/lib/delivery";
import { SupportThread, TicketBadge, useTicketsRealtime } from "@/components/support-chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/suporte")({
  head: () => ({ meta: [{ title: "Suporte — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: AdminSupport,
});

function AdminSupport() {
  const now = useNow();
  useTicketsRealtime();
  const [sel, setSel] = useState<string | null>(null);
  const [f, setF] = useState<"open" | "all">("open");
  const { data } = useQuery({
    queryKey: ["support-tickets", "admin"],
    queryFn: async () => {
      const { data: tickets } = await supabase.from("support_tickets").select("*").order("last_message_at", { ascending: false }).limit(300);
      const ids = [...new Set((tickets ?? []).map((t) => t.user_id))];
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, username").in("id", ids) : { data: [] };
      return { tickets: tickets ?? [], names: Object.fromEntries((profiles ?? []).map((p) => [p.id, p.username])) as Record<string, string> };
    },
  });
  const tickets = (data?.tickets ?? []).filter((t) => f === "all" || t.status === "open");
  const current = data?.tickets.find((t) => t.id === sel) ?? null;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Suporte</h1>
      <p className="mt-1 text-sm text-muted-foreground">Prazo de resposta: 48 horas após a mensagem do cliente.</p>
      <div className="mt-4 flex gap-2">
        {(["open", "all"] as const).map((x) => (
          <button key={x} onClick={() => setF(x)} className={cn("rounded-full px-4 py-1.5 text-sm", f === x ? "bg-secondary" : "text-muted-foreground")}>
            {x === "open" ? "Aguardando resposta" : "Todos"}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">Nenhum chamado.</p>}
          {tickets.map((t) => (
            <button key={t.id} onClick={() => setSel(t.id)}
              className={cn("w-full rounded-2xl px-4 py-3 text-left", t.id === sel ? "bg-secondary" : "bg-surface")}>
              <p className="truncate text-sm font-medium">{t.subject}</p>
              <p className="mb-1 text-xs text-muted-foreground">@{data?.names[t.user_id] ?? "cliente"} · {new Date(t.last_message_at).toLocaleString("pt-BR")}</p>
              <TicketBadge t={t} now={now} />
            </button>
          ))}
        </div>
        {current ? <SupportThread ticket={current} asAdmin /> : <p className="text-sm text-muted-foreground">Selecione um chamado.</p>}
      </div>
    </div>
  );
}
