import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildPixPayload } from "@/lib/pix";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  head: () => ({ meta: [{ title: "Pagamento Pix — SDP tech" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await supabase.from("orders").select("*").eq("id", id).single()).data,
    refetchInterval: (q) => (q.state.data?.status === "paid" ? false : 10000),
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await supabase.from("store_settings").select("*").eq("id", 1).single()).data,
  });
  const [qr, setQr] = useState("");

  const payload =
    order && settings?.pix_key
      ? buildPixPayload({
          key: settings.pix_key,
          name: settings.pix_name,
          city: settings.pix_city,
          amountCents: order.amount_cents,
          txid: order.id.slice(0, 25),
        })
      : "";

  useEffect(() => {
    if (payload) QRCode.toDataURL(payload, { width: 480, margin: 1 }).then(setQr);
  }, [payload]);

  if (!order) return <div className="py-32 text-center text-muted-foreground">Carregando…</div>;

  if (order.status === "paid")
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
        <h1 className="mt-4 text-3xl font-semibold">Pagamento confirmado!</h1>
        <p className="mt-2 text-muted-foreground">Seu produto já está disponível.</p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/conta">Acessar meus produtos</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-md px-5 py-16 text-center">
      <h1 className="text-3xl font-semibold">Pague com Pix</h1>
      <p className="mt-2 text-muted-foreground">
        Pedido #{order.order_number} · {order.product_title} · <span className="font-medium text-foreground">{brl(order.amount_cents)}</span>
      </p>
      {payload ? (
        <>
          <div className="mx-auto mt-8 w-64 rounded-3xl bg-surface p-5">
            {qr && <img src={qr} alt="QR Code Pix" className="w-full rounded-xl" />}
          </div>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              navigator.clipboard.writeText(payload);
              toast.success("Código Pix copiado!");
            }}
          >
            <Copy /> Copiar código Pix
          </Button>
          <p className="mt-8 text-sm text-muted-foreground">
            Após o pagamento, seu acesso é liberado assim que confirmarmos o recebimento. Esta página
            atualiza sozinha.
          </p>
        </>
      ) : (
        <p className="mt-8 rounded-2xl bg-surface p-6 text-sm text-muted-foreground">
          A loja ainda não configurou a chave Pix. Tente novamente em breve.
        </p>
      )}
    </div>
  );
}
