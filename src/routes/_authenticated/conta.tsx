import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { brl, dateBR } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { useNow } from "@/lib/delivery";
import { OrderTracker, StatusBadge } from "@/components/order-tracker";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({ meta: [{ title: "Minha conta — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: Account,
});

function Account() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const now = useNow();
  const { data } = useQuery({
    queryKey: ["my-orders", uid],
    enabled: !!uid,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("*, products(cover_url)")
        .eq("user_id", uid!)
        .order("created_at", { ascending: false });
      const paidIds = (orders ?? []).filter((o) => o.status === "paid" && o.product_id).map((o) => o.product_id!);
      const { data: assets } = paidIds.length
        ? await supabase.from("product_assets").select("*").in("product_id", paidIds)
        : { data: [] };
      const paidOrderIds = (orders ?? []).filter((o) => o.status === "paid").map((o) => o.id);
      const { data: items } = paidOrderIds.length
        ? await supabase.from("inventory_items").select("order_id, content, position").in("order_id", paidOrderIds).order("position")
        : { data: [] };
      return { orders: orders ?? [], assets: assets ?? [], items: items ?? [] };
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile", uid],
    enabled: !!uid,
    queryFn: async () => (await supabase.from("profiles").select("username").eq("id", uid!).maybeSingle()).data,
  });

  const download = async (path: string) => {
    const { data: s, error } = await supabase.storage.from("files").createSignedUrl(path, 60);
    if (error || !s) { toast.error("Não foi possível gerar o download."); return; }
    window.open(s.signedUrl, "_blank");
  };

  const orders = data?.orders ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-4xl font-semibold">Minha conta.</h1>
      <p className="mt-2 text-muted-foreground">{profile?.username && <>@{profile.username} · </>}{session?.user.email}</p>
      <h2 className="mt-12 text-xl font-semibold">Meus pedidos</h2>
      {orders.length === 0 && (
        <p className="mt-4 text-muted-foreground">
          Nenhum pedido ainda. <Link to="/produtos" className="text-primary">Explorar produtos</Link>
        </p>
      )}
      <div className="mt-4 space-y-3">
        {orders.map((o) => {
          const a = data?.assets.find((x) => x.product_id === o.product_id);
          return (
            <div key={o.id} id={`pedido-${o.order_number}`} className="rounded-2xl bg-surface p-4">
             <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {o.products?.cover_url && <img src={o.products.cover_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
              <div className="flex-1">
                <p className="font-medium"><span className="text-muted-foreground">Pedido #{o.order_number}</span> · {o.product_title}{o.quantity > 1 && ` × ${o.quantity}`}</p>
                <p className="text-xs text-muted-foreground">
                  {dateBR(o.created_at)} · {brl(o.amount_cents)}
                </p>
              </div>
              <div className="flex gap-2">
                {o.status === "pending" && (
                  <Button asChild size="sm">
                    <Link to="/pedido/$id" params={{ id: o.id }}>Pagar</Link>
                  </Button>
                )}
                {o.status === "paid" && a?.file_path && (
                  <Button size="sm" onClick={() => download(a.file_path!)}><Download /> Baixar</Button>
                )}
                {o.status === "paid" && a?.access_url && (
                  <Button asChild size="sm" variant="outline">
                    <a href={a.access_url} target="_blank" rel="noreferrer"><ExternalLink /> Acessar</a>
                  </Button>
                )}
              </div>
              <StatusBadge order={o} now={now} />
             </div>
             <OrderTracker order={o} now={now} />
             {o.status === "paid" && (() => {
               const mine = (data?.items ?? []).filter((i) => i.order_id === o.id);
               if (mine.length) return (
                 <div className="mt-3 rounded-xl bg-background p-3 text-sm">
                   <p className="font-medium">Seus itens</p>
                   <ul className="mt-1 space-y-1 font-mono text-xs">{mine.map((i) => <li key={i.position} className="select-all break-all">{i.content}</li>)}</ul>
                 </div>
               );
               if (o.delivery_status === "awaiting_stock")
                 return <p className="mt-3 text-sm text-muted-foreground">Pagamento confirmado. Seu produto será entregue aqui assim que houver estoque.</p>;
               return null;
             })()}
             {o.status === "paid" && a?.install_instructions && (
               <details className="mt-3 rounded-xl bg-background p-3 text-sm">
                 <summary className="cursor-pointer font-medium">Orientações de instalação</summary>
                 <p className="mt-2 whitespace-pre-line text-muted-foreground">{a.install_instructions}</p>
               </details>
             )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
