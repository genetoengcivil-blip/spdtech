import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { Zap, ShieldCheck, Infinity as InfinityIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    const [, , settings] = await Promise.all([
      context.queryClient.ensureQueryData(productsQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
      context.queryClient.ensureQueryData(settingsQuery).catch(() => null),
    ]);
    return { settings };
  },
  head: ({ loaderData }) => {
    const s = loaderData?.settings;
    const title = s?.site_title ?? "SDP tech — Cursos, e-books e templates digitais";
    const desc = s?.site_description ?? "Produtos digitais selecionados. Pague com Pix e acesse na hora.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(s?.og_image_url
          ? [{ property: "og:image", content: s.og_image_url }, { name: "twitter:image", content: s.og_image_url }]
          : []),
      ],
    };
  },
  component: Index,
});

function Index() {
  const { data: products } = useSuspenseQuery(productsQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const list = products.slice().sort((a, b) =>
    a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" }),
  );

  return (
    <div>
      <section className="mx-auto max-w-4xl px-5 pb-16 pt-24 text-center sm:pt-32">
        <img
          src="/icon-192.png"
          alt="Logo SDP tech"
          width={96}
          height={96}
          className="fade-up mx-auto mb-5 h-20 w-20 rounded-[22%] shadow-lg sm:h-24 sm:w-24"
        />
        <p className="fade-up text-sm font-medium text-primary">SDP tech</p>
        <h1 className="fade-up mt-3 text-5xl font-semibold leading-[1.05] sm:text-7xl">
          Mais por menos.
        </h1>
        <p className="fade-up mx-auto mt-6 max-w-xl text-lg text-muted-foreground sm:text-xl">
          Produtos digitais com preços baixos. Pague com Pix e economize.
        </p>
        <div className="fade-up mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/produtos">Ver produtos</Link>
          </Button>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/produtos"
                search={{ categoria: c.slug }}
                className="rounded-full bg-surface px-5 py-2.5 text-sm transition-colors hover:bg-muted"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 max-w-6xl px-5">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-3xl font-semibold sm:text-4xl">Em destaque.</h2>
          <Link to="/produtos" className="text-sm text-primary hover:underline">
            Ver todos ›
          </Link>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 grid max-w-6xl gap-6 px-5 sm:grid-cols-3">
        {[
          { icon: Zap, t: "Acesso imediato", d: "Liberado assim que o pagamento é confirmado." },
          { icon: ShieldCheck, t: "Pix seguro", d: "Pague pelo app do seu banco em segundos." },
          { icon: InfinityIcon, t: "Para sempre", d: "Seus produtos ficam salvos na sua conta." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-3xl bg-surface p-8">
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 text-lg font-semibold">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
