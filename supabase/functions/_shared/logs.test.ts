// Regra LGPD nos logs das Edge Functions (WML-45): nada de CPF, nome ou e-mail.
// Verificação estática: toda chamada console.* só pode registrar texto fixo, códigos, contagens
// ou mensagens de erro já passadas por erroSeguro()/causa().
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..');

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    if (e.isDirectory()) return fontes(caminho);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [caminho] : [];
  });
}

/** Argumentos de cada console.*(...) do arquivo, com parênteses balanceados. */
function chamadasDeLog(codigo: string): string[] {
  const chamadas: string[] = [];
  const inicio = /console\.(log|info|warn|error|debug)\(/g;
  for (let m = inicio.exec(codigo); m; m = inicio.exec(codigo)) {
    let nivel = 1;
    let i = m.index + m[0].length;
    for (; i < codigo.length && nivel > 0; i++) {
      if (codigo[i] === '(') nivel++;
      else if (codigo[i] === ')') nivel--;
    }
    chamadas.push(codigo.slice(m.index + m[0].length, i - 1));
  }
  return chamadas;
}

const DADO_PESSOAL = /\b(cpf|email|nome|para|item|form|texto|p_cpf|p_email|p_nome)\b/i;
const SANITIZADO = /\b(erroSeguro|causa)\([^()]*\)/g;

describe('logs das Edge Functions', () => {
  const arquivos = fontes(RAIZ);

  it('encontra as funções e chamadas de log', () => {
    expect(arquivos.some((a) => a.includes('register'))).toBe(true);
    expect(arquivos.flatMap((a) => chamadasDeLog(readFileSync(a, 'utf8'))).length).toBeGreaterThan(
      0,
    );
  });

  it.each(fontes(RAIZ).map((a) => [a.slice(RAIZ.length + 1)]))(
    '%s não registra dado pessoal nem mensagem de erro crua',
    (relativo) => {
      for (const args of chamadasDeLog(readFileSync(join(RAIZ, relativo), 'utf8'))) {
        const semSanitizados = args.replace(SANITIZADO, '');
        expect(semSanitizados, `console(${args})`).not.toMatch(DADO_PESSOAL);
        expect(semSanitizados, `console(${args}) — use erroSeguro()/causa()`).not.toMatch(
          /\.message\b/,
        );
      }
    },
  );
});
