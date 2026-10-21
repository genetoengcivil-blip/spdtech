import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { productQuery } from "@/lib/queries";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Reviews } from "@/components/reviews";

export const Route = createFileRoute("/produto/$slug")({
  loader: async ({ context, params }) => {
    const p = await context.queryClient.ensureQueryData(productQuery(params.slug));
    if (!p) throw notFound();
    return { title: p.title, subtitle: p.subtitle };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Produto não encontrado — SDP tech" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.title} — SDP tech`;
    const d = loaderData.subtitle ?? "Produto digital com acesso imediato.";
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="py-32 text-center">
      <p className="text-muted-foreground">Produto não encontrado.</p>
      <Link to="/produtos" className="mt-4 inline-block text-primary">Ver produtos</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: p } = useSuspenseQuery(productQuery(slug));
  const { session } = useAuth();
  const navigate = useNavigate();
  if (!p) return null;

  const buy = () => {
    if (!session) navigate({ to: "/auth", search: { redirect: `/checkout/${p.id}` } });
    else navigate({ to: "/checkout/$productId", params: { productId: p.id } });
  };

  const notifyMe = async () => {
    if (!session) { navigate({ to: "/auth", search: { redirect: `/produto/${p.slug}` } }); return; }
    const { error } = await supabase.from("stock_alerts").insert({ product_id: p.id, user_id: session.user.id });
    if (error && !error.message.includes("duplicate")) { toast.error("Não foi possível salvar o aviso."); return; }
    toast.success("Pronto! Avisaremos no sino quando o produto voltar.");
  };

  return (
    <>
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-12 md:grid-cols-2 md:gap-16 md:pt-20">
      <div className="overflow-hidden rounded-3xl bg-surface">
        {p.cover_url ? (
          <img src={p.cover_url} alt={p.title} className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square items-center justify-center text-7xl font-semibold text-muted-foreground/30">
            {p.title.charAt(0)}
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center">
        {p.categories && <span className="text-sm font-medium text-primary">{p.categories.name}</span>}
        <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">{p.title}</h1>
        {p.subtitle && <p className="mt-3 text-xl text-muted-foreground">{p.subtitle}</p>}
        <p className="mt-8 text-3xl font-semibold">{brl(p.price_cents)}</p>
        <p className="text-sm text-muted-foreground">
          à vista no Pix · {p.sold_count} vendido{p.sold_count === 1 ? "" : "s"}
          {p.stock_quantity !== null && p.stock_quantity > 0 && ` · restam ${p.stock_quantity}`}
        </p>
        {p.stock_quantity !== null && p.stock_quantity <= 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="lg" className="w-full sm:w-auto" disabled>Esgotado</Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" onClick={notifyMe}>
              <Bell className="h-4 w-4" /> Avise-me quando chegar
            </Button>
          </div>
        ) : (
          <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={buy}>
            Comprar agora
          </Button>
        )}
        <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
          {["Acesso liberado após confirmação do Pix", "Disponível para sempre na sua conta"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" /> {t}
            </li>
          ))}
        </ul>
        {p.description && (
          <div className="mt-10 border-t border-border pt-8">
            <h2 className="text-lg font-semibold">Sobre</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-muted-foreground">{p.description}</p>
          </div>
        )}
      </div>
    </div>
    <Reviews productId={p.id} />
    </>
  );
}
