import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { dateBR } from "@/lib/format";

export function NotificationsBell({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", userId],
    refetchInterval: 30000,
    queryFn: async () =>
      (await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const unread = data.filter((n) => !n.read).length;

  const markRead = async () => {
    if (!unread) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications", userId] });
  };

  return (
    <Popover onOpenChange={(o) => !o && markRead()}>
      <PopoverTrigger className="relative text-foreground/70 hover:text-foreground" aria-label="Avisos">
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-2">
        <p className="px-2 py-1.5 text-sm font-semibold">Avisos</p>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum aviso.</p>}
          {data.map((n) => (
            <Link
              key={n.id}
              to={(n.link ?? "/conta") as "/conta"}
              className="block rounded-xl px-2 py-2 hover:bg-muted"
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                {n.title}
              </p>
              {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">{dateBR(n.created_at)}</p>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
