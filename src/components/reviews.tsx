import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} estrelas`}>
          <Star className={cn("h-4 w-4", n <= value ? "fill-warning text-warning" : "text-border")} />
        </button>
      ))}
    </div>
  );
}

export function Reviews({ productId }: { productId: string }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { data } = useQuery({
    queryKey: ["reviews", productId, uid],
    queryFn: async () => {
      const { data: reviews } = await supabase.from("reviews").select("*").eq("product_id", productId).order("created_at", { ascending: false });
      let canReview = false;
      if (uid) canReview = !!(await supabase.rpc("has_paid", { _user: uid, _product: productId })).data;
      return { reviews: reviews ?? [], canReview };
    },
  });
  const reviews = data?.reviews ?? [];
  const mine = reviews.find((r) => r.user_id === uid);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const submit = async () => {
    const name = (session?.user.user_metadata?.['full_name'] as string) || session?.user.email?.split("@")[0] || "Cliente";
    const { error } = await supabase.from("reviews").insert({ product_id: productId, rating, comment: comment.trim() || null, author_name: name });
    if (error) { toast.error("Não foi possível enviar a avaliação."); return; }
    toast.success("Obrigado pela avaliação!");
    setComment("");
    qc.invalidateQueries({ queryKey: ["reviews", productId] });
  };

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="flex items-end gap-3">
        <h2 className="text-2xl font-semibold">Avaliações</h2>
        {reviews.length > 0 && <span className="text-sm text-muted-foreground">{avg.toFixed(1)} de 5 · {reviews.length} {reviews.length === 1 ? "avaliação" : "avaliações"}</span>}
      </div>
      {data?.canReview && !mine && (
        <div className="mt-6 rounded-2xl bg-surface p-4">
          <p className="text-sm font-medium">Avalie sua compra</p>
          <div className="mt-2"><Stars value={rating} onChange={setRating} /></div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} placeholder="Conte o que achou (opcional)"
            className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <Button size="sm" className="mt-2" onClick={submit}>Enviar avaliação</Button>
        </div>
      )}
      {reviews.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Ainda sem avaliações.</p>}
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{r.author_name}</span>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
