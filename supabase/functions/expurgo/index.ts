// Edge Function `expurgo` (WML-52 · S6): chamada uma vez por dia pelo pg_cron
// (public.disparar_expurgo) com o cabeçalho x-cron-secret, só quando há algo vencido.
// Apaga os PDFs vencidos pela API do Storage e depois os dados vencidos no banco.
// Regra LGPD: nada de dado pessoal em logs — só contagens.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { erroSeguro } from '../_shared/erro-seguro.ts';
import { executarExpurgo } from '../_shared/expurgo.ts';
import { segredoConfere } from '../_shared/segredo-cron.ts';

const env = (nome: string) => Deno.env.get(nome) ?? '';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!segredoConfere(req.headers.get('x-cron-secret') ?? '', env('SEND_EMAILS_SECRET'))) {
    return new Response(null, { status: 401 });
  }
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  try {
    const resumo = await executarExpurgo({
      async pdfsPendentes() {
        const { data, error } = await admin.rpc('expurgo_pdfs_pendentes');
        if (error) throw new Error(`expurgo_pdfs_pendentes ${error.code ?? ''}`);
        return (data as string[]) ?? [];
      },
      async apagarArquivos(caminhos) {
        const { data, error } = await admin.storage.from('trabalhos').remove(caminhos);
        if (error) throw new Error(`storage.remove ${erroSeguro(error.message)}`);
        // Não confirmado pelo Storage: se o arquivo já não existe (execução anterior interrompida),
        // conta como apagado; senão fica pendente para o dia seguinte.
        const sairam = new Set((data ?? []).map((o) => o.name));
        const resultado: string[] = [];
        for (const c of caminhos) {
          if (sairam.has(c)) {
            resultado.push(c);
            continue;
          }
          const { data: achados } = await admin.storage
            .from('trabalhos')
            .list('', { search: c, limit: 1 });
          if (!achados?.some((o) => o.name === c)) resultado.push(c);
        }
        return resultado;
      },
      async concluirPdfs(caminhos) {
        const { data, error } = await admin.rpc('concluir_expurgo_pdfs', { p_caminhos: caminhos });
        if (error) throw new Error(`concluir_expurgo_pdfs ${error.code ?? ''}`);
        return data as number;
      },
      async expurgarDados() {
        const { data, error } = await admin.rpc('expurgar_dados');
        if (error) throw new Error(`expurgar_dados ${error.code ?? ''}`);
        return data as { dados_pessoais: number; participantes: number };
      },
    });
    console.log('expurgo', JSON.stringify(resumo));
    return Response.json(resumo);
  } catch (e) {
    console.error('expurgo falhou', erroSeguro(e));
    return Response.json({ erro: 'falha no expurgo' }, { status: 500 });
  }
});
