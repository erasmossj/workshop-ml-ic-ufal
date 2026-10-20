// E-mail do certificado (WML-59 · ADR-005): texto + HTML simples e o PDF montado na hora.
// O CPF completo vai só dentro do PDF (exigência do certificado), nunca no corpo do e-mail.
import { formatarCargaHoraria, gerarCertificado, type Campos } from './certificado.ts';
import { escaparHtml, type Mensagem } from './email-confirmacao.ts';
import { EVENTO } from './evento-gerado.ts';

export type DadosEmailCertificado = {
  numero: string;
  nome: string;
  email: string;
  /** 11 dígitos — só para o PDF. */
  cpf: string;
  minutos: number;
  codigo: string;
};

const AZUL = '#071a45';
const LARANJA = '#e87722';

export async function montarEmailCertificado(
  d: DadosEmailCertificado,
  opcoes: { modelo: Uint8Array; campos: Campos; siteUrl: string },
): Promise<Mensagem> {
  const site = opcoes.siteUrl.replace(/\/$/, '');
  const urlValidar = `${site}/validar?codigo=${encodeURIComponent(d.codigo)}`;
  const urlBaixar = `${site}/certificado`;
  const primeiroNome = d.nome.trim().split(/\s+/)[0];
  const carga = formatarCargaHoraria(d.minutos);

  const pdf = await gerarCertificado(opcoes.modelo, opcoes.campos, {
    nome: d.nome,
    cpf: d.cpf,
    minutos: d.minutos,
    codigo: d.codigo,
    urlValidacao: `${site}/validar`,
  });

  const texto = [
    `Olá, ${primeiroNome}!`,
    '',
    `Obrigado por participar do ${EVENTO.sigla} — ${EVENTO.nome}. Seu certificado está anexado.`,
    '',
    `Carga horária: ${carga}`,
    `Código de validação: ${d.codigo}`,
    `Qualquer pessoa pode conferir a autenticidade em: ${urlValidar}`,
    '',
    `Perdeu o arquivo? Baixe de novo em ${urlBaixar} com o seu e-mail e o número de inscrição (${d.numero}).`,
    '',
    `${EVENTO.sigla} · ${EVENTO.realizacao}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 4px;color:${LARANJA};font-weight:bold;letter-spacing:.05em">${escaparHtml(EVENTO.sigla)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:${AZUL}">Seu certificado</h1>
<p>Olá, ${escaparHtml(primeiroNome)}!</p>
<p>Obrigado por participar do <strong>${escaparHtml(EVENTO.sigla)} — ${escaparHtml(EVENTO.nome)}</strong>. Seu certificado em PDF está anexado.</p>
<p><strong>Carga horária:</strong> ${escaparHtml(carga)}<br>
<strong>Código de validação:</strong> ${escaparHtml(d.codigo)}</p>
<p>Qualquer pessoa pode conferir a autenticidade em <a href="${escaparHtml(urlValidar)}" style="color:${AZUL}">${escaparHtml(urlValidar)}</a>.</p>
<p>Perdeu o arquivo? Baixe de novo em <a href="${escaparHtml(urlBaixar)}" style="color:${AZUL}">${escaparHtml(urlBaixar)}</a> com o seu e-mail e o número de inscrição (<strong>${escaparHtml(d.numero)}</strong>).</p>
<p style="color:#555;font-size:13px">${escaparHtml(EVENTO.sigla)} · ${escaparHtml(EVENTO.realizacao)}</p>
</div></body></html>`;

  return {
    para: d.email,
    assunto: `${EVENTO.sigla} · Seu certificado · ${d.numero}`,
    texto,
    html,
    anexos: [{ nome: `certificado-${d.numero}.pdf`, conteudo: pdf, tipo: 'application/pdf' }],
  };
}
