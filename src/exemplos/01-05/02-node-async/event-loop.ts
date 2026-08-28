/**
 * Por que "Node é não-bloqueante" — e onde essa promessa quebra.
 *
 * Rodar:  node src/exemplos/01-05/02-node-async/event-loop.ts
 */
import { setTimeout as esperar } from 'node:timers/promises';

function agora() {
  return new Date().toISOString().slice(11, 23); // só HH:MM:SS.mmm
}

/** Trabalho de CPU: um loop que realmente ocupa o processador. */
function calcularPesado(voltas: number) {
  let soma = 0;
  for (let i = 0; i < voltas; i++) soma += Math.sqrt(i);
  return soma;
}

console.log(`[${agora()}] início`);

// ---------------------------------------------------------------------
// PARTE 1 — I/O NÃO bloqueia
// ---------------------------------------------------------------------
// Três esperas de 1s disparadas juntas terminam em ~1s no total, não 3s.
// Enquanto elas esperam, o Node fica livre para fazer outra coisa.
// É por isso que um servidor Node atende milhares de conexões simultâneas
// com uma única thread: quase todo tempo é espera, não trabalho.

console.log('\n--- 3 esperas de 1s, em paralelo ---');
const t1 = Date.now();
await Promise.all([esperar(1000), esperar(1000), esperar(1000)]);
console.log(`Levou ${Date.now() - t1}ms (não ~3000ms)`);

// Em série é outra história: cada `await` espera o anterior terminar.
console.log('\n--- as mesmas 3 esperas, em série ---');
const t2 = Date.now();
await esperar(300);
await esperar(300);
await esperar(300);
console.log(`Levou ${Date.now() - t2}ms (~900ms, a soma)`);

// REGRA: se as tarefas não dependem uma da outra, use Promise.all.
// `await` dentro de um for é o erro de performance mais comum em Node.

// ---------------------------------------------------------------------
// PARTE 2 — CPU BLOQUEIA, e trava tudo
// ---------------------------------------------------------------------
// O event loop é UMA fila. Enquanto seu código roda, nada mais roda:
// nenhum timer dispara, nenhuma requisição HTTP é atendida.

console.log('\n--- timer agendado para 0ms, seguido de trabalho pesado ---');
const t3 = Date.now();

setTimeout(() => {
  // Pedimos "daqui a 0ms", mas só executa quando o loop ficar livre.
  console.log(`  timer de 0ms rodou depois de ${Date.now() - t3}ms`);
}, 0);

calcularPesado(200_000_000); // segura o event loop
console.log(`  o trabalho pesado terminou em ${Date.now() - t3}ms`);

// Num servidor, esse bloqueio significa TODOS os clientes esperando.
// Trabalho pesado de CPU vai para uma fila/worker — assunto do módulo 17.

await esperar(50);
console.log(`\n[${agora()}] fim`);
