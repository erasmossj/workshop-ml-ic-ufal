// Gera supabase/functions/_shared/evento-gerado.ts a partir de src/data/evento.ts (fonte única).
// As Edge Functions não enxergam src/, então o e-mail e o comprovante usam esta cópia.
// Uso: npm run gerar:evento   (o teste evento-gerado.test.ts acusa se a cópia ficar desatualizada)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { evento, eventosDeAgenda } from '../src/data/evento.ts';

const destino = fileURLToPath(
  new URL('../supabase/functions/_shared/evento-gerado.ts', import.meta.url),
);

const dados = {
  sigla: evento.sigla,
  nome: evento.nome,
  realizacao: evento.realizacao,
  datasTexto: evento.datasTexto,
  local: evento.local,
  agenda: eventosDeAgenda().map((e) => ({
    ...e,
    inicio: e.inicio.toISOString(),
    fim: e.fim.toISOString(),
  })),
};

const codigo = `// GERADO por scripts/gerar-evento-funcoes.mjs a partir de src/data/evento.ts — não edite.
// Depois de mudar o conteúdo do evento, rode: npm run gerar:evento
export const EVENTO = ${JSON.stringify(dados, null, 2)} as const;
`;

const opcoes = await prettier.resolveConfig(destino);
await writeFile(destino, await prettier.format(codigo, { ...opcoes, parser: 'typescript' }));
console.log('evento-gerado.ts atualizado');
