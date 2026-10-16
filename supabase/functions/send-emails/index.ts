// Edge Function `send-emails` (WML-29..31): chamada pelo pg_cron (public.disparar_envio_emails)
// com o cabeçalho x-cron-secret. Reserva um lote da fila (teto diário no banco), monta o e-mail
// de confirmação com comprovante + .ics e envia pelo Gmail (SMTP 465); Brevo é a reserva.
// Regra LGPD: nada de CPF, nome ou e-mail em logs — só contagens.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'nodemailer';
import { montarEmailConfirmacao, type Mensagem } from '../_shared/email-confirmacao.ts';
import { processarFila, type Fila, type ItemFila, type Provedor } from '../_shared/envio.ts';
import { EVENTO } from '../_shared/evento-gerado.ts';

const env = (nome: string) => Deno.env.get(nome) ?? '';

function segredoConfere(recebido: string, esperado: string): boolean {
  if (esperado.length < 32 || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++)
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}

function base64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

function provedorGmail(): Provedor | null {
  const usuario = env('GMAIL_USER');
  if (!usuario) return null;
  const porta = Number(env('SMTP_PORT') || '465');
  const senha = env('GMAIL_APP_PASSWORD');
  // Local: SMTP_HOST aponta para o Inbucket/Mailpit do Supabase (porta 1025, sem TLS nem senha).
  const transporte = nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port: porta,
    secure: porta === 465,
    auth: senha ? { user: usuario, pass: senha } : undefined,
  });
  return {
    nome: 'gmail',
    enviar: async (m: Mensagem) => {
      await transporte.sendMail({
        from: { name: EVENTO.sigla, address: usuario },
        to: m.para,
        subject: m.assunto,
        text: m.texto,
        html: m.html,
        attachments: m.anexos.map((a) => ({
          filename: a.nome,
          content: base64(a.conteudo),
          encoding: 'base64',
          contentType: a.tipo,
        })),
      });
    },
  };
}

function provedorBrevo(): Provedor | null {
  const chave = env('BREVO_API_KEY');
  const remetente = env('BREVO_SENDER') || env('GMAIL_USER');
  if (!chave || !remetente) return null;
  return {
    nome: 'brevo',
    enviar: async (m: Mensagem) => {
      const r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': chave,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: EVENTO.sigla, email: remetente },
          to: [{ email: m.para }],
          subject: m.assunto,
          textContent: m.texto,
          htmlContent: m.html,
          attachment: m.anexos.map((a) => ({ name: a.nome, content: base64(a.conteudo) })),
        }),
      });
      if (!r.ok) throw new Error(`Brevo ${r.status}`);
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (!segredoConfere(req.headers.get('x-cron-secret') ?? '', env('SEND_EMAILS_SECRET'))) {
    return new Response(null, { status: 401 });
  }

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const fila: Fila = {
    reservar: async (lote) => {
      const { data, error } = await admin.rpc('reservar_emails', { p_lote: lote });
      if (error) throw new Error(`reservar_emails: ${error.code}`);
      return data as ItemFila[];
    },
    concluir: async (id, r) => {
      const { error } = await admin.rpc('concluir_email', {
        p_id: id,
        p_sucesso: r.ok,
        p_provedor: r.ok ? r.provedor : null,
        p_erro: r.ok ? null : r.erro,
      });
      if (error) console.error('concluir_email falhou', error.code);
    },
  };

  const provedores = [provedorGmail(), provedorBrevo()].filter((p): p is Provedor => p !== null);
  const segredoQr = env('QR_HMAC_SECRET');
  try {
    const resumo = await processarFila({
      fila,
      provedores,
      lote: Number(env('EMAIL_LOTE') || '10'),
      montar: async (item) => {
        if (item.tipo !== 'confirmacao') throw new Error('TIPO_NAO_SUPORTADO');
        return montarEmailConfirmacao(
          {
            numero: item.numero,
            nome: item.nome,
            email: item.email,
            cpfMascarado: item.cpf_mascarado,
            minicurso: item.minicurso,
            trabalho: item.trabalho,
          },
          { segredoQr, siteUrl: env('SITE_URL') || undefined },
        );
      },
    });
    console.log('send-emails', JSON.stringify(resumo));
    return Response.json(resumo);
  } catch (e) {
    console.error('send-emails falhou', e instanceof Error ? e.message : 'erro');
    return Response.json({ erro: 'falha ao processar a fila' }, { status: 500 });
  }
});
