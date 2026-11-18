// SCA do CI: roda `npm audit --json` e falha em aviso alto ou crítico (como --audit-level=high),
// exceto os riscos aceitos em .github/sca-excecoes.json — cada um só no pacote indicado e só até
// a data "ate" (fim do dia, horário de Maceió). Regra e justificativas: docs/seguranca/SCA-EXCECOES.md
// Uso: node scripts/auditoria-sca.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BLOQUEIA = new Set(['high', 'critical']);

/** @typedef {{ ghsa: string, pacote: string, ate: string, motivo?: string }} Excecao */

/**
 * Separa os avisos altos/críticos do relatório em bloqueantes e aceitos por exceção vigente.
 * Avisos herdados (`via` em texto) já aparecem no pacote de origem, então cada aviso conta uma vez.
 * @param {{ vulnerabilities?: Record<string, { via?: (string | Record<string, any>)[] }> }} relatorio
 * @param {Excecao[]} excecoes
 * @param {Date} [agora]
 */
export function avaliarAuditoria(relatorio, excecoes, agora = new Date()) {
  const avisos = new Map();
  for (const v of Object.values(relatorio.vulnerabilities ?? {})) {
    for (const via of v.via ?? []) {
      if (typeof via !== 'object' || !BLOQUEIA.has(via.severity)) continue;
      const ghsa = via.url?.split('/').pop() ?? String(via.source);
      avisos.set(`${ghsa} ${via.name}`, {
        ghsa,
        pacote: via.name,
        severidade: via.severity,
        titulo: via.title,
        url: via.url,
      });
    }
  }
  const vigente = (e) => agora <= new Date(`${e.ate}T23:59:59.999-03:00`);
  const bloqueantes = [];
  const aceitos = [];
  for (const a of avisos.values()) {
    const ok = excecoes.some((e) => e.ghsa === a.ghsa && e.pacote === a.pacote && vigente(e));
    (ok ? aceitos : bloqueantes).push(a);
  }
  return { bloqueantes, aceitos, vencidas: excecoes.filter((e) => !vigente(e)) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let saida;
  try {
    saida = execSync('npm audit --json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (erro) {
    // npm audit sai com código 1 quando encontra vulnerabilidade; o relatório vem no stdout.
    saida = erro.stdout;
  }
  const relatorio = JSON.parse(saida || '{}');
  if (!relatorio.vulnerabilities) {
    console.error('::error::npm audit não devolveu relatório:', relatorio.error?.summary ?? saida);
    process.exit(1);
  }
  const excecoes = JSON.parse(
    readFileSync(new URL('../.github/sca-excecoes.json', import.meta.url), 'utf8'),
  );
  const { bloqueantes, aceitos, vencidas } = avaliarAuditoria(relatorio, excecoes);
  for (const a of aceitos) {
    const ate = excecoes.find((e) => e.ghsa === a.ghsa).ate;
    console.log(`::warning::Risco aceito até ${ate}: ${a.ghsa} (${a.pacote}) — ${a.titulo}`);
  }
  for (const e of vencidas) {
    console.log(
      `::warning::Exceção vencida em ${e.ate}: ${e.ghsa} (${e.pacote}) — revisar ou remover`,
    );
  }
  for (const a of bloqueantes) {
    console.log(`::error::${a.severidade}: ${a.ghsa} (${a.pacote}) — ${a.titulo} ${a.url}`);
  }
  console.log(`SCA: ${bloqueantes.length} bloqueante(s), ${aceitos.length} aceito(s) por exceção.`);
  process.exitCode = bloqueantes.length ? 1 : 0;
}
