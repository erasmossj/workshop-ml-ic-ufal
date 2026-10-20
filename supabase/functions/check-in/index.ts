// Edge Function `check-in` (WML-54/55 · ADR-004): leitor de QR da organização.
// O login do organizador vem no Authorization (JWT do magic link) e é validado no Auth;
// a allowlist `organizadores` é conferida aqui e de novo dentro da RPC check_in.
// O segredo do QR (QR_HMAC_SECRET) nunca sai do servidor. Nada de dado pessoal em logs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { realizarCheckIn } from '../_shared/check-in.ts';
import { erroSeguro } from '../_shared/erro-seguro.ts';
import { criarVerificadorDeOrigem } from '../_shared/origens.ts';
import { verificarToken } from '../_shared/qr.ts';

const origemPermitida = criarVerificadorDeOrigem(Deno.env.get('ALLOWED_ORIGINS') ?? '');

function cabecalhos(origem: string): HeadersInit {
  const base: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origemPermitida(origem)) base['Access-Control-Allow-Origin'] = origem;
  return base;
}

Deno.serve(async (req) => {
  const h = cabecalhos(req.headers.get('origin') ?? '');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ erro: 'Método não permitido.' }), {
      status: 405,
      headers: h,
    });
  }

  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {
    // corpo inválido → realizarCheckIn devolve 400
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const segredo = Deno.env.get('QR_HMAC_SECRET') ?? '';
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  const r = await realizarCheckIn(corpo, {
    async operador() {
      if (!jwt) return null;
      const { data, error } = await admin.auth.getUser(jwt);
      const email = data?.user?.email?.toLowerCase();
      if (error || !email) return null;
      const { data: org, error: erroOrg } = await admin
        .from('organizadores')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      if (erroOrg) throw new Error(erroOrg.message);
      return { email, organizador: Boolean(org) };
    },
    verificarToken: (token) => verificarToken(token, segredo),
    async checkIn(a) {
      const { data, error } = await admin.rpc('check_in', {
        p_numero: a.numero,
        p_dia: a.dia,
        p_minicurso: a.minicurso,
        p_origem: a.origem,
        p_operador: a.operador,
      });
      if (error) throw new Error(`${error.code ?? ''} ${erroSeguro(error.message)}`);
      return (data as { resultado: string; numero: string | null; nome: string | null }[])[0];
    },
  }).catch((e) => {
    console.error('check-in falhou', erroSeguro(e));
    return { status: 500, corpo: { erro: 'Erro inesperado. Tente novamente.' } };
  });

  return new Response(JSON.stringify(r.corpo), { status: r.status, headers: h });
});
