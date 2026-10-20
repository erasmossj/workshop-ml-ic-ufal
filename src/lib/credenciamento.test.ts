import { describe, expect, it } from 'vitest';
import {
  criarFiltroRepeticao,
  diaPadrao,
  hojeEmMaceio,
  mensagemDoResultado,
  tokenDoQr,
} from './credenciamento';

const DIAS = ['2026-12-02', '2026-12-03', '2026-12-04'];

describe('mensagens do leitor', () => {
  it('ok mostra o nome e o número para conferência', () => {
    const m = mensagemDoResultado(
      { resultado: 'ok', nome: 'Ana Sintética', numero: 'ICML26-0042' },
      'dia',
    );
    expect(m.tom).toBe('ok');
    expect(m.titulo).toBe('Presença registrada');
    expect(m.detalhe).toContain('Ana Sintética');
    expect(m.detalhe).toContain('ICML26-0042');
  });

  it('ok no modo Minicurso deixa claro que é o minicurso', () => {
    expect(mensagemDoResultado({ resultado: 'ok', nome: 'Ana' }, 'minicurso').titulo).toBe(
      'Presença no minicurso registrada',
    );
  });

  it.each([
    ['ja_registrado', 'aviso', 'Já registrado'],
    ['nao_inscrito_minicurso', 'erro', 'Não inscrito no minicurso'],
    ['cancelada', 'erro', 'Inscrição cancelada'],
    ['inexistente', 'erro', 'Inscrição não encontrada'],
    ['qr_invalido', 'erro', 'QR Code inválido'],
    ['dia_invalido', 'erro', 'Dia fora do evento'],
    ['qualquer-coisa', 'erro', 'Resultado inesperado'],
  ])('%s → tom %s', (resultado, tom, titulo) => {
    const m = mensagemDoResultado({ resultado }, 'dia');
    expect(m.tom).toBe(tom);
    expect(m.titulo).toContain(titulo);
  });

  it('nunca menciona CPF ou e-mail', () => {
    for (const r of ['ok', 'ja_registrado', 'cancelada', 'nao_inscrito_minicurso']) {
      const m = mensagemDoResultado({ resultado: r, nome: 'Ana', numero: 'ICML26-0001' }, 'dia');
      expect(`${m.titulo} ${m.detalhe}`).not.toMatch(/cpf|e-mail/i);
    }
  });
});

describe('dia padrão', () => {
  it('é hoje quando hoje é dia de evento', () => {
    expect(diaPadrao('2026-12-03', DIAS)).toBe('2026-12-03');
  });
  it('é o primeiro dia fora do evento (ensaio, demonstração)', () => {
    expect(diaPadrao('2026-10-23', DIAS)).toBe('2026-12-02');
  });
  it('hoje é calculado no fuso de Maceió', () => {
    // 01:30 UTC de 03/12 ainda é 22:30 de 02/12 em Maceió.
    expect(hojeEmMaceio(new Date('2026-12-03T01:30:00Z'))).toBe('2026-12-02');
  });
});

describe('leitura do QR', () => {
  it('aceita o token do comprovante, sem espaços', () => {
    expect(tokenDoQr('  ICML26-0042.abcDEF_123-xyz \n')).toBe('ICML26-0042.abcDEF_123-xyz');
  });
  it.each(['', 'https://exemplo.com', 'ICML26-0042', 'a.b.c', 'x'.repeat(200), '<script>.x'])(
    'ignora QR que não é de inscrição: %s',
    (texto) => {
      expect(tokenDoQr(texto)).toBeNull();
    },
  );
});

describe('filtro de repetição da câmera', () => {
  it('ignora o mesmo QR por alguns segundos e aceita depois', () => {
    const deve = criarFiltroRepeticao(4000);
    expect(deve('A.b', 0)).toBe(true);
    expect(deve('A.b', 1000)).toBe(false);
    expect(deve('C.d', 1500)).toBe(true);
    expect(deve('A.b', 5001)).toBe(true);
  });
});
