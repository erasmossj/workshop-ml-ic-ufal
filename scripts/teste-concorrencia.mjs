// Teste de concorrência das vagas (WML-28 · ADR-003): N inscrições simultâneas pela última vaga
// → exatamente 1 sucesso. SÓ roda contra o Supabase LOCAL (dados sintéticos).
// Uso: npm run test:concorrencia   (lê URL e chave de `supabase status`)
import { execSync } from 'node:child_process';
import { cpfValido } from '../src/lib/cpf.ts';

const N = Number(process.argv[2] ?? 50);
const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const URL_API = env.API_URL;
const CHAVE = env.SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_API ?? '')) {
  console.error('Recusado: este teste só roda contra o Supabase local.');
  process.exit(1);
}

const headers = {
  apikey: CHAVE,
  Authorization: `Bearer ${CHAVE}`,
  'Content-Type': 'application/json',
};
const rest = (caminho, init) => fetch(`${URL_API}/rest/v1/${caminho}`, { headers, ...init });

// CPFs sintéticos válidos.
function gerarCpfs(qtd) {
  const lista = [];
  for (let base = 500000000; lista.length < qtd; base++) {
    for (let dv = 0; dv < 100; dv++) {
      const cpf = `${base}${String(dv).padStart(2, '0')}`;
      if (cpfValido(cpf)) {
        lista.push(cpf);
        break;
      }
    }
  }
  return lista;
}

// Prepara: janela aberta e um minicurso com 1 vaga.
const agora = Date.now();
await rest('config_evento?id=eq.true', {
  method: 'PATCH',
  body: JSON.stringify({
    inscricoes_inicio: new Date(agora - 86400000).toISOString(),
    inscricoes_fim: new Date(agora + 86400000).toISOString(),
  }),
});
const slug = `concorrencia-${agora}`;
const criado = await rest('minicursos', {
  method: 'POST',
  headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify({ slug, titulo: 'Teste de concorrência', vagas: 1 }),
}).then((r) => r.json());
const minicursoId = criado[0].id;

const cpfs = gerarCpfs(N);
const t0 = performance.now();
const respostas = await Promise.all(
  cpfs.map((cpf, i) =>
    rest('rpc/register_participant', {
      method: 'POST',
      body: JSON.stringify({
        p_nome: 'Pessoa Concorrente',
        p_cpf: cpf,
        p_email: `concorrencia-${agora}-${i}@exemplo.com`,
        p_instituicao: null,
        p_minicursos: [minicursoId],
        p_trabalho: null,
      }),
    }).then(async (r) => ({ ok: r.ok, corpo: await r.json() })),
  ),
);
const ms = Math.round(performance.now() - t0);

const sucessos = respostas.filter((r) => r.ok).length;
const esgotados = respostas.filter((r) => r.corpo?.message === 'MINICURSO_ESGOTADO').length;
const [mc] = await rest(`minicursos?id=eq.${minicursoId}&select=vagas,ocupadas`).then((r) =>
  r.json(),
);

const resultado = {
  requisicoes: N,
  sucessos,
  esgotados,
  outros: N - sucessos - esgotados,
  ...mc,
  ms,
};
console.log(JSON.stringify(resultado, null, 2));
const passou = sucessos === 1 && esgotados === N - 1 && mc.ocupadas === 1;
console.log(
  passou ? 'PASSOU: nenhuma vaga vendida a mais.' : 'FALHOU: overbooking ou erro inesperado.',
);
process.exit(passou ? 0 : 1);
