// Os prazos publicados na política (/privacidade) e os usados pelo expurgo automático (S6) precisam
// ser os mesmos: mudou um, mude o outro (src/data/evento.ts e a migration do expurgo).
import { readFileSync } from 'node:fs';
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
