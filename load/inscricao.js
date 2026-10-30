// Teste de carga da inscrição (WML-36 · RNF01): 300 usuários em ~1 min, SOMENTE no staging.
// Critérios: p95 < 2 s, nenhum 5xx, ocupadas ≤ vagas. Dados 100% sintéticos (e-mail @exemplo.com).
// Preparação e limpeza do staging: docs/RUNBOOK.md › Teste de carga.
//
//   docker run --rm -i -e BASE_URL=https://<ref>.supabase.co -e ANON_KEY=<anon do staging> \
//     grafana/k6 run - < load/inscricao.js

/* global __ENV, __VU, __ITER -- variáveis do runtime do k6 */
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL;
const ANON_KEY = __ENV.ANON_KEY;
const PRODUCAO = 'sjzyipebykiaiasdafai';
const USUARIOS = Number(__ENV.USUARIOS || 300);
const EXECUCAO = Date.now();

const erros5xx = new Rate('erros_5xx');
const bloqueados = new Counter('bloqueados_429');
const esgotados = new Counter('minicurso_esgotado');

export const options = {
  scenarios: {
    // CENARIO=rnf01 (padrão): critério do plano — 300 inscrições ao longo de ~1 min (5/s).
    // CENARIO=pico: estresse — as 300 no mesmo instante (abertura das inscrições, pior caso).
    pico:
      __ENV.CENARIO === 'pico'
        ? { executor: 'per-vu-iterations', vus: USUARIOS, iterations: 1, maxDuration: '1m' }
        : {
            executor: 'constant-arrival-rate',
            rate: Math.ceil(USUARIOS / 60),
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: USUARIOS,
          },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    erros_5xx: ['rate==0'],
    // 429 = limite por origem não foi aumentado no staging: o teste não mede nada útil.
    bloqueados_429: ['count==0'],
    checks: ['rate>0.99'],
  },
};

/** CPF sintético válido (dígitos verificadores corretos) a partir de um número. */
function cpfSintetico(n) {
  const base = String(100000000 + (n % 800000000))
    .padStart(9, '0')
    .split('')
    .map(Number);
  for (const k of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < k; i++) soma += base[i] * (k + 1 - i);
    const resto = (soma * 10) % 11;
    base.push(resto === 10 ? 0 : resto);
  }
  return base.join('');
}

function vagas() {
  const r = http.post(`${BASE_URL}/rest/v1/rpc/vagas_publicas`, '{}', {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  });
  if (r.status !== 200) fail(`vagas_publicas respondeu ${r.status}`);
  return r.json();
}

export function setup() {
  if (!BASE_URL || !ANON_KEY) fail('Defina BASE_URL e ANON_KEY (staging).');
  if (BASE_URL.includes(PRODUCAO)) fail('Teste de carga NUNCA roda contra a produção.');
  return { antes: vagas() };
}

export default function () {
  const id = `${__VU}-${__ITER}`;
  const comMinicurso = __VU % 2 === 0;
  const corpo = {
    nome: 'Participante Carga Sintética',
    cpf: cpfSintetico((EXECUCAO % 1000) * 100000 + __VU * 10 + __ITER),
    email: `carga-${id}-${EXECUCAO}@exemplo.com`,
    consentimento: 'sim',
    vinculo: 'graduacao',
    // Chave de TESTE do Turnstile no staging aceita qualquer token.
    'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX',
  };
  if (comMinicurso) corpo.minicurso = 'sim';

  const r = http.post(`${BASE_URL}/functions/v1/register`, corpo, {
    headers: { apikey: ANON_KEY },
    tags: { minicurso: String(comMinicurso) },
  });

  erros5xx.add(r.status >= 500);
  if (r.status >= 500) {
    // A resposta de erro da função não tem dado pessoal (só a mensagem genérica).
    console.error(`5xx: status=${r.status} corpo=${String(r.body).slice(0, 120)}`);
  }
  if (r.status === 429) bloqueados.add(1);
  const codigo = r.status === 409 ? r.json('codigo') : null;
  if (codigo === 'MINICURSO_ESGOTADO') esgotados.add(1);

  check(r, {
    // 409 só é aceitável para minicurso esgotado/fechado (disputa pela última vaga).
    'inscrição aceita ou minicurso esgotado': () =>
      r.status === 201 || ['MINICURSO_ESGOTADO', 'MINICURSO_FECHADO'].includes(codigo),
    'resposta sem CPF': () => !String(r.body).includes(corpo.cpf),
  });
}

export function teardown({ antes }) {
  const depois = vagas();
  for (const m of depois) {
    const ok = m.restantes === null || m.restantes >= 0;
    console.log(
      `${m.slug}: vagas=${m.vagas} restantes antes=${antes.find((a) => a.slug === m.slug)?.restantes} depois=${m.restantes}`,
    );
    if (!ok) fail(`OVERBOOKING em ${m.slug}: restantes=${m.restantes}`);
  }
}
