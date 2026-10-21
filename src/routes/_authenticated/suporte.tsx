import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNow } from "@/lib/delivery";
import { SupportThread, TicketBadge, useTicketsRealtime } from "@/components/support-chat";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suporte")({
  head: () => ({ meta: [{ title: "Suporte — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: Support,
});

function Support() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const now = useNow();
  useTicketsRealtime();
  const [sel, setSel] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  const { data: tickets = [] } = useQuery({
    queryKey: ["support-tickets", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("support_tickets").select("*").eq("user_id", uid!).order("last_message_at", { ascending: false })).data ?? [],
  });
  const current = tickets.find((t) => t.id === sel) ?? null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: t, error } = await supabase.from("support_tickets").insert({ subject: subject.trim(), user_id: uid! }).select("id").single();
    if (error || !t) { toast.error("Não foi possível abrir o chamado."); return; }
    await supabase.from("support_messages").insert({ ticket_id: t.id, body: msg.trim(), sender_id: uid! });
    setSubject(""); setMsg(""); setSel(t.id);
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
    toast.success("Chamado aberto. Respondemos em até 48 horas.");
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold">Suporte.</h1>
      <p className="mt-2 text-muted-foreground">Fale com a gente por aqui. Respondemos em até 48 horas, e toda a conversa fica salva.</p>

      <form onSubmit={create} className="mt-8 space-y-2 rounded-2xl bg-surface p-4">
        <p className="text-sm font-medium">Novo chamado</p>
        <Input required minLength={2} maxLength={120} placeholder="Assunto" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <textarea required maxLength={4000} rows={3} placeholder="Descreva sua dúvida ou problema" value={msg} onChange={(e) => setMsg(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="sm" disabled={!subject.trim() || !msg.trim()}>Abrir chamado</Button>
      </form>

      <div className="mt-8 space-y-2">
        {tickets.map((t) => (
          <button key={t.id} onClick={() => setSel(t.id === sel ? null : t.id)}
            className={cn("flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left", t.id === sel ? "bg-secondary" : "bg-surface")}>
            <span className="truncate text-sm font-medium">{t.subject}</span>
            <TicketBadge t={t} now={now} />
          </button>
        ))}
      </div>
      {current && <div className="mt-4"><SupportThread ticket={current} asAdmin={false} /></div>}
    </div>
  );
}
