// Converts supplier (English, HTML) descriptions into clean Portuguese text
// using a fixed glossary of common catalog phrases. No AI involved.
const GLOSSARY: [RegExp, string][] = [
  [/digital key/gi, "Chave digital"],
  [/instant delivery/gi, "Entrega imediata"],
  [/\bglobal\b/gi, "Global"],
  [/no payment method required for activation/gi, "Não precisa de forma de pagamento para ativar"],
  [/redeem page/gi, "Página de resgate"],
  [/only works on accounts with no previous ([\w\s]+?) subscriptions/gi, "só funciona em contas sem assinatura anterior de $1"],
  [/must be redeemed within (\d+) days? of purchase/gi, "deve ser resgatado em até $1 dias após a compra"],
  [/\btrial\b/gi, "Teste"],
  [/\bplan\b/gi, "Plano"],
  [/\bduration\b/gi, "Duração"],
  [/(\d+)\s*months?/gi, "$1 meses"],
  [/(\d+)\s*years?/gi, "$1 anos"],
  [/(\d+)\s*days?/gi, "$1 dias"],
  [/\bmonths?\b/gi, "meses"],
  [/access:\s*on your account/gi, "Acesso: na sua própria conta"],
  [/on your account/gi, "na sua conta"],
  [/\baccess\b/gi, "Acesso"],
  [/official coupon code/gi, "Cupom oficial"],
  [/no warranty after activation/gi, "Sem garantia após a ativação"],
  [/need card to activate/gi, "Precisa de cartão para ativar"],
  [/\bwarranty\b/gi, "Garantia"],
  [/\bactivation\b/gi, "Ativação"],
  [/\bprivate\b/gi, "Privado"],
  [/\bshared\b/gi, "Compartilhado"],
  [/\blifetime\b/gi, "Vitalício"],
  [/\bcode\b/gi, "Código"],
  [/\binstant\b/gi, "Imediata"],
];

export function supplierTextPt(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|blockquote|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  for (const [re, pt] of GLOSSARY) s = s.replace(re, pt);
  return s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export const DELIVERY_PT: Record<string, string> = { instant: "Imediata", manual: "Manual" };
export const TYPE_PT: Record<string, string> = { code: "Código", account: "Conta", key: "Chave" };
