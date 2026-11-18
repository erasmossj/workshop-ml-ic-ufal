import { describe, expect, it } from 'vitest';
import { avaliarAuditoria } from './auditoria-sca.mjs';

const aviso = (ghsa: string, nome: string, severity: string) => ({
  source: 1,
  name: nome,
  title: `falha em ${nome}`,
  url: `https://github.com/advisories/${ghsa}`,
  severity,
  range: '<=1.0.0',
});

/** Formato do `npm audit --json` (npm 7+): avisos ficam em `via` (objeto) ou são herdados (string). */
const relatorio = (...avisos: ReturnType<typeof aviso>[]) => ({
  vulnerabilities: Object.fromEntries([
    ...avisos.map((a) => [a.name, { name: a.name, severity: a.severity, via: [a] }]),
    // Pacote que só herda o aviso de uma dependência.
    ['vite', { name: 'vite', severity: 'high', via: avisos.map((a) => a.name) }],
  ]),
});

const HOJE = new Date('2026-11-18T12:00:00-03:00');
const EXCECAO = {
  ghsa: 'GHSA-fc5q-39xc-vjpf',
  pacote: 'picomatch',
  ate: '2026-12-31',
  motivo: 'sem versão corrigida',
};

describe('avaliarAuditoria', () => {
  it('passa sem vulnerabilidades', () => {
    expect(avaliarAuditoria({ vulnerabilities: {} }, [], HOJE)).toEqual({
      bloqueantes: [],
      aceitos: [],
      vencidas: [],
    });
  });

  it('bloqueia aviso alto ou crítico', () => {
    const r = avaliarAuditoria(
      relatorio(
        aviso('GHSA-aaaa-bbbb-cccc', 'pkg-a', 'high'),
        aviso('GHSA-dddd-eeee-ffff', 'pkg-b', 'critical'),
      ),
      [],
      HOJE,
    );
    expect(r.bloqueantes.map((a) => a.ghsa)).toEqual([
      'GHSA-aaaa-bbbb-cccc',
      'GHSA-dddd-eeee-ffff',
    ]);
  });

  it('ignora moderado e baixo (mesmo nível do --audit-level=high)', () => {
    const r = avaliarAuditoria(
      relatorio(
        aviso('GHSA-g3hv-75wg-m249', 'minimatch', 'moderate'),
        aviso('GHSA-1111-2222-3333', 'x', 'low'),
      ),
      [],
      HOJE,
    );
    expect(r.bloqueantes).toEqual([]);
  });

  it('conta cada aviso uma vez, mesmo herdado por vários pacotes', () => {
    const a = aviso('GHSA-aaaa-bbbb-cccc', 'pkg-a', 'high');
    const rel = relatorio(a);
    rel.vulnerabilities['outro'] = { name: 'outro', severity: 'high', via: [a] };
    expect(avaliarAuditoria(rel, [], HOJE).bloqueantes).toHaveLength(1);
  });

  it('aceita só o aviso da exceção vigente, e só no pacote dela', () => {
    const r = avaliarAuditoria(
      relatorio(
        aviso('GHSA-fc5q-39xc-vjpf', 'picomatch', 'high'),
        aviso('GHSA-aaaa-bbbb-cccc', 'pkg-a', 'high'),
      ),
      [EXCECAO],
      HOJE,
    );
    expect(r.aceitos.map((a) => a.ghsa)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(r.bloqueantes.map((a) => a.ghsa)).toEqual(['GHSA-aaaa-bbbb-cccc']);

    const outroPacote = avaliarAuditoria(
      relatorio(aviso('GHSA-fc5q-39xc-vjpf', 'micromatch', 'high')),
      [EXCECAO],
      HOJE,
    );
    expect(outroPacote.bloqueantes).toHaveLength(1);
  });

  it('exceção vale até o fim do dia "ate" (Maceió) e depois volta a bloquear', () => {
    const rel = relatorio(aviso('GHSA-fc5q-39xc-vjpf', 'picomatch', 'high'));
    expect(
      avaliarAuditoria(rel, [EXCECAO], new Date('2026-12-31T23:59:00-03:00')).bloqueantes,
    ).toEqual([]);
    const depois = avaliarAuditoria(rel, [EXCECAO], new Date('2027-01-01T00:00:00-03:00'));
    expect(depois.bloqueantes.map((a) => a.ghsa)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(depois.vencidas.map((e) => e.ghsa)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });
});
