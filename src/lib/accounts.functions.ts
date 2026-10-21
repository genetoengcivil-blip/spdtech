import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Account = {
  id: string;
  email: string;
  name: string;
  phone: string;
  blocked: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Account[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error("Falha ao listar contas.");
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const adminSet = new Set((admins ?? []).map((a) => a.user_id));
    return data.users.map((u) => {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const banned = (u as { banned_until?: string | null }).banned_until;
      return {
        id: u.id,
        email: u.email ?? "",
        name: String(meta["full_name"] ?? meta["name"] ?? ""),
        phone: String(meta["phone"] ?? u.phone ?? ""),
        blocked: !!banned && new Date(banned) > new Date(),
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        is_admin: adminSet.has(u.id),
      };
    });
  });

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; name: string; phone: string }) => {
    const email = clean(d?.email, 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido");
    const password = String(d?.password ?? "");
    if (password.length < 6 || password.length > 72) throw new Error("Senha deve ter ao menos 6 caracteres");
    return { email, password, name: clean(d?.name, 120), phone: clean(d?.phone, 40) };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.name, phone: data.phone },
    });
    if (error) return { ok: false as const, error: /already/i.test(error.message) ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta." };
    return { ok: true as const };
  });

export const updateAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; email: string; name: string; phone: string; password?: string | undefined }) => {
    const email = clean(d?.email, 255).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido");
    const password = d?.password ? String(d.password) : "";
    if (password && (password.length < 6 || password.length > 72)) throw new Error("Senha deve ter ao menos 6 caracteres");
    return { id: clean(d?.id, 64), email, name: clean(d?.name, 120), phone: clean(d?.phone, 40), password };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(data.id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      email_confirm: true,
      ...(data.password ? { password: data.password } : {}),
      user_metadata: { ...(existing.user?.user_metadata ?? {}), full_name: data.name, phone: data.phone },
    });
    if (error) return { ok: false as const, error: "Não foi possível salvar a conta." };
    return { ok: true as const };
  });

export const setAccountBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; blocked: boolean }) => ({ id: clean(d?.id, 64), blocked: !!d?.blocked }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "Você não pode bloquear a sua própria conta." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.blocked ? "876000h" : "none",
    });
    if (error) return { ok: false as const, error: "Não foi possível atualizar a conta." };
    return { ok: true as const };
  });

export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; password: string }) => {
    const password = String(d?.password ?? "");
    if (password.length < 6 || password.length > 72) throw new Error("Senha deve ter ao menos 6 caracteres");
    return { id: clean(d?.id, 64), password };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) return { ok: false as const, error: "Não foi possível redefinir a senha." };
    return { ok: true as const };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: clean(d?.id, 64) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.id === context.userId) return { ok: false as const, error: "Você não pode apagar a sua própria conta." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: data.id, _role: "admin" });
    if (isAdmin) return { ok: false as const, error: "A conta admin não pode ser apagada." };
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) return { ok: false as const, error: "Não foi possível apagar a conta." };
    return { ok: true as const };
  });
