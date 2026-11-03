// Os prazos publicados na política (/privacidade) e os usados pelo expurgo automático (S6) precisam
// ser os mesmos: mudou um, mude o outro (src/data/evento.ts e a migration do expurgo).
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { privacidade } from './evento';

const migration = readFileSync('supabase/migrations/20261022090000_expurgo.sql', 'utf8');
const padrao = (coluna: string) =>
  migration.match(
    new RegExp(`add column ${coluna} date not null default '([0-9]{4}-[0-9]{2}-[0-9]{2})'`),
  )?.[1];

describe('prazos de retenção', () => {
  it.each([
    ['expurgo_pdfs', /PDF/],
    ['expurgo_pessoais', /CPF/],
    ['expurgo_final', /certificado/],
  ])('%s é a data publicada na política', (coluna, dado) => {
    const publicado = privacidade.retencao.find((r) => dado.test(r.dados));
    expect(publicado, `item da política com ${dado}`).toBeDefined();
    expect(padrao(coluna)).toBe(publicado!.ate);
  });
});

// Acervo (WML-73 · ADR-007): os PDFs SEM autorização continuam saindo em expurgo_pdfs; a única
// exceção no banco é aprovado + autorizado, e nenhuma migration muda o prazo publicado.
describe('acervo não afrouxa o expurgo de PDFs', () => {
  const migrations = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'));
  const ultimaDefinicao = (funcao: string) =>
    migrations.filter((m) => m.includes(`function public.${funcao}(`)).at(-1)!;

  it('nenhuma migration muda o prazo dos PDFs', () => {
    const pdf = privacidade.retencao.find((r) => /PDF/.test(r.dados))!.ate;
    for (const m of migrations) {
      for (const [, data] of m.matchAll(
        /expurgo_pdfs\s*(?:date[^']*default|=)\s*'([0-9-]{10})'/g,
      )) {
        expect(data).toBe(pdf);
      }
    }
  });

  it('expurgo_pdfs_pendentes só poupa aprovado + autorizado (e não cancelado)', () => {
    const sql = ultimaDefinicao('expurgo_pdfs_pendentes');
    expect(sql).toContain('p_hoje > c.expurgo_pdfs');
    expect(sql).toMatch(
      /and not \(t\.acervo and t\.status in \('aprovado_oral', 'aprovado_poster'\) and p\.cancelada_em is null\)/,
    );
  });
});
