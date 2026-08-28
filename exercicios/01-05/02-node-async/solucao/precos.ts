/**
 * Solução do exercício 02 — série vs paralelo vs tolerante a falha.
 *
 * Rodar:  node exercicios/01-05/02-node-async/solucao/precos.ts
 */
import { setTimeout as esperar } from 'node:timers/promises';

const LATENCIA_MS = 250;

/**
 * Simula uma API de preços: sempre demora, às vezes falha.
 *
 * Repare que é `async` mas o `throw` é normal — dentro de uma função async,
 * `throw` vira Promise rejeitada. Quem chamar precisa de `catch` ou `.catch()`.
 */
async function buscarPreco(sku: string): Promise<number> {
  await esperar(LATENCIA_MS);
  if (sku.startsWith('X')) throw new Error(`SKU inexistente: ${sku}`);
  return sku.length * 10 + 9.9;
}

// ---------------------------------------------------------------------
// Série: uma espera por vez
// ---------------------------------------------------------------------
// O `await` dentro do for é o erro de performance mais comum em Node.
// Aqui ele é intencional, para servir de comparação.
async function buscarEmSerie(skus: string[]): Promise<{ precos: number[]; ms: number }> {
  const inicio = Date.now();
  const precos: number[] = [];
  for (const sku of skus) {
    precos.push(await buscarPreco(sku)); // só dispara a próxima quando esta volta
  }
  return { precos, ms: Date.now() - inicio };
}

// ---------------------------------------------------------------------
// Paralelo: dispara todas, espera o conjunto
// ---------------------------------------------------------------------
// O segredo está na ordem: `map` cria todas as Promises (que já começaram a
// rodar) e só então `Promise.all` espera. Nada de `await` dentro do map.
async function buscarEmParalelo(
  skus: string[],
): Promise<{ precos: number[]; ms: number }> {
  const inicio = Date.now();
  const precos = await Promise.all(skus.map((sku) => buscarPreco(sku)));
  return { precos, ms: Date.now() - inicio };
}

// ---------------------------------------------------------------------
// Tolerante: uma falha não derruba o lote
// ---------------------------------------------------------------------
// `Promise.all` é "tudo ou nada" — se um SKU falha, você perde os outros cinco
// que já tinham dado certo. `allSettled` nunca rejeita: devolve o status de cada.
async function buscarTolerante(
  skus: string[],
): Promise<{ ok: Record<string, number>; falhas: string[] }> {
  const resultados = await Promise.allSettled(skus.map((sku) => buscarPreco(sku)));

  const ok: Record<string, number> = {};
  const falhas: string[] = [];

  for (const [i, resultado] of resultados.entries()) {
    const sku = skus[i]!; // `!` porque noUncheckedIndexedAccess vê `string | undefined`
    // `status` é o discriminante: dentro do if, o TS sabe que `.value` existe.
    if (resultado.status === 'fulfilled') ok[sku] = resultado.value;
    else falhas.push(sku);
  }

  return { ok, falhas };
}

// ---------------------------------------------------------------------
// Demonstração
// ---------------------------------------------------------------------

const skus = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

const serie = await buscarEmSerie(skus);
console.log(`série     → ${serie.ms}ms  (~${skus.length * LATENCIA_MS}ms esperado)`);

const paralelo = await buscarEmParalelo(skus);
console.log(`paralelo  → ${paralelo.ms}ms  (~${LATENCIA_MS}ms esperado)`);

console.log(`ganho     → ${(serie.ms / paralelo.ms).toFixed(1)}× mais rápido`);

// Erro em paralelo: `Promise.all` propaga a primeira rejeição.
// O `await` precisa estar DENTRO do try, senão o catch não pega nada.
try {
  await buscarEmParalelo(['A1', 'X9']);
  console.log('esta linha não roda');
} catch (erro) {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  console.log(`all falhou → ${mensagem} (e perdemos o preço de A1 junto)`);
}

const tolerante = await buscarTolerante(['A1', 'X9', 'A3']);
console.log('tolerante →', tolerante);

// ---------------------------------------------------------------------
// Desafio extra: timeout com Promise.race
// ---------------------------------------------------------------------
// `race` resolve/rejeita com a PRIMEIRA que terminar. Serve de timeout.
//
// Pegadinha: a busca original continua rodando. `race` só ignora o resultado,
// não cancela nada. Cancelamento de verdade precisa de AbortController — que é
// o que o `fetch` aceita via `{ signal }`.
async function buscarComTimeout(sku: string, ms: number): Promise<number> {
  const estouro = esperar(ms).then(() => {
    throw new Error(`timeout de ${ms}ms em ${sku}`);
  });
  return Promise.race([buscarPreco(sku), estouro]);
}

try {
  await buscarComTimeout('A1', 100); // 100ms < 250ms de latência → estoura
} catch (erro) {
  console.log('timeout   →', erro instanceof Error ? erro.message : erro);
}

console.log('preço com folga →', await buscarComTimeout('A1', 500));
