// E-mail do certificado (WML-59 · ADR-005): texto + HTML simples e o PDF montado na hora.
// O CPF completo vai só dentro do PDF (exigência do certificado), nunca no corpo do e-mail.
import { formatarCargaHoraria, gerarCertificado, type Campos } from './certificado.ts';
import { escaparHtml, ESTILO, moldeEmail, type Mensagem } from './email-confirmacao.ts';
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

  const html = moldeEmail({
    etiqueta: `Certificado · ${EVENTO.sigla}`,
    titulo: 'Seu certificado',
    siteUrl: site,
    corpo: `<p>Olá, ${escaparHtml(primeiroNome)}!</p>
<p>Obrigado por participar do <strong>${escaparHtml(EVENTO.sigla)} — ${escaparHtml(EVENTO.nome)}</strong>. Seu certificado em PDF está anexado.</p>
<p><strong>Carga horária:</strong> ${escaparHtml(carga)}<br>
<strong>Código de validação:</strong> <span style="${ESTILO.mono}">${escaparHtml(d.codigo)}</span></p>
<p>Qualquer pessoa pode conferir a autenticidade em <a href="${escaparHtml(urlValidar)}" style="${ESTILO.link}">${escaparHtml(urlValidar)}</a>.</p>
<p>Perdeu o arquivo? Baixe de novo em <a href="${escaparHtml(urlBaixar)}" style="${ESTILO.link}">${escaparHtml(urlBaixar)}</a> com o seu e-mail e o número de inscrição (<strong>${escaparHtml(d.numero)}</strong>).</p>`,
  });

  return {
    para: d.email,
    assunto: `${EVENTO.sigla} · Seu certificado · ${d.numero}`,
    texto,
    html,
    anexos: [{ nome: `certificado-${d.numero}.pdf`, conteudo: pdf, tipo: 'application/pdf' }],
  };
}
