import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { countdown, useNow } from "@/lib/delivery";

type Ticket = { id: string; subject: string; status: string; due_at: string | null; created_at: string };

export function TicketBadge({ t, now }: { t: Ticket; now: number }) {
  if (t.status === "closed") return <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">Encerrado</span>;
  if (t.status === "answered") return <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success">Respondido</span>;
  const left = countdown(t.due_at, now);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px]", left ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive")}>
      {left ? `Resposta em até ${left}` : "Prazo de 48h vencido"}
    </span>
  );
}

export function SupportThread({ ticket, asAdmin }: { ticket: Ticket; asAdmin: boolean }) {
  const qc = useQueryClient();
  const now = useNow();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const key = ["support-messages", ticket.id];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("support_messages").select("*").eq("ticket_id", ticket.id).order("created_at")).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel(`support-${ticket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${ticket.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["support-messages", ticket.id] });
        qc.invalidateQueries({ queryKey: ["support-tickets"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ticket.id, qc]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [data.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("support_messages").insert({ ticket_id: ticket.id, body, from_admin: asAdmin, sender_id: u.user!.id });
    if (error) { toast.error("Não foi possível enviar."); return; }
    setText("");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  };

  const close = async () => {
    await supabase.from("support_tickets").update({ status: "closed", due_at: null }).eq("id", ticket.id);
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  };

  return (
    <div className="flex flex-col rounded-2xl bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border p-4">
        <div className="min-w-0">
          <p className="truncate font-medium">{ticket.subject}</p>
          <TicketBadge t={ticket} now={now} />
        </div>
        {asAdmin && ticket.status !== "closed" && <Button size="sm" variant="ghost" onClick={close}>Encerrar</Button>}
      </div>
      <div className="max-h-[50vh] min-h-48 space-y-2 overflow-y-auto p-4">
        {data.map((m) => {
          const mine = m.from_admin === asAdmin;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-background")}>
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {m.from_admin ? "Suporte" : "Cliente"} · {new Date(m.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder="Escreva sua mensagem…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}><Send /></Button>
      </form>
    </div>
  );
}

export function useTicketsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("support-tickets")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => qc.invalidateQueries({ queryKey: ["support-tickets"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}
