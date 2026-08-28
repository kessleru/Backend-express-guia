/**
 * Callbacks → Promises → async/await, e as armadilhas de erro no caminho.
 *
 * Rodar:  node src/exemplos/01-05/02-node-async/promises.ts
 */
import { setTimeout as esperar } from 'node:timers/promises';

type Usuario = { id: number; nome: string };

/** Simula ir ao banco: demora um pouco e às vezes falha. */
async function buscarUsuario(id: number): Promise<Usuario> {
  await esperar(200);
  if (id <= 0) throw new Error(`Id inválido: ${id}`);
  return { id, nome: `Usuário ${id}` };
}

// ---------------------------------------------------------------------
// 1. As três gerações da assincronia
// ---------------------------------------------------------------------

// Callback (estilo antigo): erro vem como PRIMEIRO argumento.
// Encadear vira o "callback hell" — indentação crescendo à direita.
function buscarComCallback(id: number, cb: (erro: Error | null, u?: Usuario) => void) {
  buscarUsuario(id).then(
    (u) => cb(null, u),
    (e: Error) => cb(e),
  );
}

buscarComCallback(1, (erro, usuario) => {
  console.log('1. callback →', erro ? erro.message : usuario);
});

// Promise: encadeamento plano, com .catch no fim.
void buscarUsuario(2).then((u) => console.log('2. promise  →', u));

// async/await: lê como código síncrono. É o que usamos no resto do curso.
const usuario = await buscarUsuario(3);
console.log('3. await    →', usuario);

// ---------------------------------------------------------------------
// 2. Tratamento de erro
// ---------------------------------------------------------------------

// Certo: o await está DENTRO do try.
try {
  await buscarUsuario(-1);
} catch (erro) {
  // `erro` é `unknown` — pode ser qualquer coisa, não só Error.
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.log('4. capturado →', mensagem);
}

// ARMADILHA: try/catch que não pega nada.
// Sem `await`, a função retorna uma Promise e o try já terminou quando ela
// rejeita. O erro vira "unhandled rejection" e pode derrubar o processo.
try {
  void buscarUsuario(-1).catch((e: Error) => {
    console.log('5. o catch do try NÃO pegou isto →', e.message);
  });
} catch {
  console.log('esta linha nunca roda');
}

// ---------------------------------------------------------------------
// 3. Paralelo de verdade
// ---------------------------------------------------------------------

const ids = [10, 20, 30];

// Lento: 3 × 200ms. Cada volta espera a anterior sem precisar.
const inicioSerie = Date.now();
const emSerie: Usuario[] = [];
for (const id of ids) {
  emSerie.push(await buscarUsuario(id));
}
console.log(`6. em série  → ${Date.now() - inicioSerie}ms`);

// Rápido: ~200ms. Dispara as três e espera o conjunto.
const inicioParalelo = Date.now();
const emParalelo = await Promise.all(ids.map((id) => buscarUsuario(id)));
console.log(
  `7. paralelo  → ${Date.now() - inicioParalelo}ms (${emParalelo.length} usuários)`,
);

// ---------------------------------------------------------------------
// 4. Concorrência limitada: o meio-termo entre série e paralelo
// ---------------------------------------------------------------------

// `Promise.all` com uma lista grande dispara TUDO no mesmo instante. Com 5 mil
// ids, são 5 mil chamadas competindo por ~10 conexões do pool do banco — as
// outras esperam na fila até estourar o timeout. Ou a API externa devolve 429.
//
// A resposta não é voltar pra série (5 mil × 200ms = 16 minutos): é limitar
// quantas correm ao mesmo tempo.
const muitosIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// O tamanho do lote é ditado pelo limite do OUTRO lado, não pelo seu código:
// o `connection_limit` do pool, o rate limit documentado da API. Escolher no
// chute troca um problema (fila no banco) por outro (lentidão sem motivo).
const TAMANHO_LOTE = 4;

const inicioLotes = Date.now();
const emLotes: Usuario[] = [];
for (let i = 0; i < muitosIds.length; i += TAMANHO_LOTE) {
  const lote = muitosIds.slice(i, i + TAMANHO_LOTE);
  // Dentro do lote é paralelo; entre lotes é série. Daí ~3 rodadas de 200ms
  // em vez de 10 (série) ou 1 (paralelo total, com 10 chamadas simultâneas).
  emLotes.push(...(await Promise.all(lote.map((id) => buscarUsuario(id)))));
}
console.log(`9. em lotes  → ${Date.now() - inicioLotes}ms (${emLotes.length} usuários)`);

// ARMADILHA: `lote.map(buscarUsuario)` parece equivalente e compila, mas o
// `map` passa três argumentos (valor, índice, array). Aqui não dói porque a
// função ignora os extras — em `['1','2'].map(parseInt)` o índice vira a base
// numérica e o resultado é [1, NaN]. Passe o argumento você mesmo.

// Este laço tem lote fixo: a rodada seguinte só começa quando a MAIS LENTA da
// anterior termina, deixando conexões ociosas no fim de cada rodada. Bibliotecas
// de fila (p-limit) mantêm N sempre ocupados. O ganho raramente justifica a
// dependência — mas saiba que o teto aqui não é o ideal.

// ---------------------------------------------------------------------
// 5. Quando uma falha
// ---------------------------------------------------------------------

// Promise.all falha inteiro se UMA falhar ("tudo ou nada").
// Quando você quer o resultado de cada uma, com sucesso ou falha:
const resultados = await Promise.allSettled([buscarUsuario(1), buscarUsuario(-1)]);
console.log('8. allSettled →', resultados.map((r) => r.status).join(', '));
