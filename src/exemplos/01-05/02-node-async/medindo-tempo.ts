/**
 * Medir tempo direito: por que `Date.now()` mente e o que usar no lugar.
 *
 * Rodar:  node src/exemplos/01-05/02-node-async/medindo-tempo.ts
 */
import { setTimeout as esperar } from 'node:timers/promises';
import { performance, PerformanceObserver, monitorEventLoopDelay } from 'node:perf_hooks';

// ---------------------------------------------------------------------
// 1. O problema: relógio de parede não serve para medir duração
// ---------------------------------------------------------------------

// `Date.now()` devolve a hora do MUNDO — quantos ms desde 1970. Esse número é
// sincronizado com servidores NTP e pode ANDAR PRA TRÁS a qualquer momento,
// quando o sistema corrige o próprio atraso. No meio de uma medição, isso vira
// uma duração negativa ou um pico fantasma de centenas de ms.
//
// `performance.now()` devolve ms desde o processo nascer. Ninguém ajusta esse
// contador: ele só cresce, sempre no mesmo ritmo.
//
// PRINCÍPIO: para saber QUANDO algo aconteceu, use o relógio; para saber QUANTO
// DEMOROU, use o cronômetro. São instrumentos diferentes.

const inicio = performance.now();
await esperar(200);
const duracao = performance.now() - inicio;

// A segunda diferença: `Date.now()` é inteiro, então tudo abaixo de 1ms vira 0.
// `performance.now()` tem casas decimais — mede o que é rápido demais pro outro.
console.log(`1. esperar(200)     → ${duracao.toFixed(3)}ms`);

const rapido = performance.now();
JSON.parse('{"a":1}');
// Date.now() aqui daria 0ms e você concluiria "é instantâneo" — não é, é rápido.
console.log(`2. um JSON.parse    → ${(performance.now() - rapido).toFixed(4)}ms`);

// ---------------------------------------------------------------------
// 2. mark / measure: medir sem poluir o código com variáveis de tempo
// ---------------------------------------------------------------------

// O par acima (`const x = performance.now()` … `- x`) não escala: cada trecho
// medido vira uma variável nova carregada até o fim da função. `mark` guarda o
// instante com um NOME, dentro do próprio Node, e `measure` calcula a distância
// entre dois nomes depois — inclusive em outro arquivo.

async function buscarUsuario(id: number) {
  performance.mark('busca:inicio');
  await esperar(120);
  performance.mark('busca:fim');

  // O terceiro argumento é o mark final. Sem ele, mede do mark até AGORA.
  performance.measure('busca de usuário', 'busca:inicio', 'busca:fim');
  return { id, nome: `Usuário ${id}` };
}

// O observer recebe as medidas conforme elas acontecem. A vantagem sobre um
// console.log direto: o código medido não sabe que está sendo observado — dá
// pra ligar isso só em desenvolvimento sem tocar na função.
const observador = new PerformanceObserver((lista) => {
  for (const entrada of lista.getEntries()) {
    console.log(`3. ${entrada.name.padEnd(18)}→ ${entrada.duration.toFixed(2)}ms`);
  }
});
observador.observe({ entryTypes: ['measure'] });

await buscarUsuario(1);

// Sem `disconnect`, este observer continua vivo e vai capturar TAMBÉM as
// measures das seções seguintes — o rótulo "3." apareceria duas vezes. Observer
// que não se desliga é a causa mais comum de métrica duplicada.
observador.disconnect();

// Marks e measures ficam num buffer que NÃO se esvazia sozinho. Num servidor
// que mede cada requisição, isso é vazamento de memória: limpe depois de usar.
performance.clearMarks();
performance.clearMeasures();

// ---------------------------------------------------------------------
// 3. timerify: cronometrar uma função sem editá-la
// ---------------------------------------------------------------------

// Quando a função é de terceiros (ou você não quer sujá-la com marks),
// `timerify` devolve uma cópia que emite a duração de cada chamada.
const buscarCronometrado = performance.timerify(buscarUsuario);

const observadorFuncao = new PerformanceObserver((lista) => {
  for (const entrada of lista.getEntries()) {
    console.log(`4. ${entrada.name}()  → ${entrada.duration.toFixed(2)}ms`);
  }
  observadorFuncao.disconnect(); // sem isso, o observer segura o processo vivo
});
observadorFuncao.observe({ entryTypes: ['function'] });

await buscarCronometrado(2);

// Repare que 4 dá ~120ms, não ~0ms: o Node reconhece que o retorno é uma
// Promise e espera ela resolver antes de fechar a medição. Não é óbvio — a
// leitura natural de "cronometrar uma chamada" pararia no `return`.
//
// ARMADILHA: `timerify` devolve uma função NOVA. Trocar a original por ela num
// `if (DEBUG)` muda a identidade da referência — quem já guardou a antiga
// (um handler registrado, um objeto de rotas) continua chamando a não medida,
// e você conclui que "a métrica não aparece".

// ---------------------------------------------------------------------
// 4. Event loop delay: a métrica que revela travamento em produção
// ---------------------------------------------------------------------

// Medir uma função responde "ela é lenta?". Esta métrica responde algo que
// nenhuma medição de função pega: "o processo inteiro está travado?".
//
// O histograma agenda um timer repetido e mede o ATRASO entre a hora pedida e
// a hora real. Se o event loop está livre, o atraso é ~0. Se alguém segurou a
// thread com trabalho de CPU, ninguém roda no prazo — e o atraso dispara.
const histograma = monitorEventLoopDelay({ resolution: 10 });
histograma.enable();

// Trecho honesto: só espera. O loop fica livre.
await esperar(100);
console.log(`5. só I/O    → atraso máx ${(histograma.max / 1e6).toFixed(1)}ms`);

histograma.reset();

// Trecho que bloqueia. O `await` no meio do laço é essencial para a MEDIÇÃO:
// o histograma só registra quando o loop consegue rodar. Um bloqueio único
// antes de um único `await` passa quase despercebido — é preciso devolver a
// vez várias vezes para o timer interno notar que chegou atrasado.
let soma = 0;
for (let volta = 0; volta < 5; volta++) {
  for (let i = 0; i < 100_000_000; i++) soma += Math.sqrt(i);
  await esperar(10);
}

console.log(`6. com CPU   → atraso máx ${(histograma.max / 1e6).toFixed(1)}ms`);
console.log(
  `   (p99: ${(histograma.percentile(99) / 1e6).toFixed(1)}ms, soma=${soma.toFixed(0)})`,
);

histograma.disable();

// Os valores vêm em NANOSSEGUNDOS — daí o `/ 1e6` pra virar ms. Ler o número
// cru e reportar "atraso de 300 milhões" é o erro clássico desta API.
//
// Em produção esse é o número que vale alarme: acima de ~100ms significa que
// requisições estão na fila esperando a thread, mesmo com a CPU "ok" no gráfico.
// A solução é worker/fila (módulo 17), não mais instâncias.

// ---------------------------------------------------------------------
// 5. Cuidado com o benchmark ingênuo
// ---------------------------------------------------------------------

// Rodar uma vez e comparar não mede nada: o JIT do V8 só otimiza o que é
// repetido, então a primeira volta é sempre a mais lenta. Meça VÁRIAS e olhe a
// mediana — a média é puxada por um pico de garbage collector qualquer.
function medir(rotulo: string, fn: () => void, voltas = 1000) {
  const amostras: number[] = [];
  for (let i = 0; i < voltas; i++) {
    const t = performance.now();
    fn();
    amostras.push(performance.now() - t);
  }
  amostras.sort((a, b) => a - b);
  const mediana = amostras[Math.floor(voltas / 2)] ?? 0;
  console.log(`7. ${rotulo.padEnd(16)}→ mediana ${(mediana * 1000).toFixed(2)}µs`);
}

const nomes = Array.from({ length: 1000 }, (_, i) => `usuário ${i}`);
medir('for clássico', () => {
  let n = 0;
  for (let i = 0; i < nomes.length; i++) if (nomes[i]!.length > 9) n++;
});
medir('filter+length', () => nomes.filter((n) => n.length > 9).length);

// A diferença existe, mas é de microssegundos numa lista de mil. Otimizar isso
// antes de medir o I/O — onde o custo é de MILIssegundos — é trocar dinheiro
// grande por trocado. Meça antes de escolher.

// ---------------------------------------------------------------------
// 6. Cheatsheet: as quatro no menor tamanho possível
// ---------------------------------------------------------------------

console.log('\n--- cheatsheet ---');

// now() — trecho curto, início e fim na mesma função.
const t = performance.now();
await esperar(30);
console.log(`now()        → ${(performance.now() - t).toFixed(1)}ms`);

// mark/measure — início e fim separados. O id no nome evita que duas execuções
// simultâneas sobrescrevam o mark uma da outra.
const id = 7;
performance.mark(`req:${id}:inicio`);
await esperar(30);
performance.mark(`req:${id}:fim`);
const medida = performance.measure(`req:${id}`, `req:${id}:inicio`, `req:${id}:fim`);
console.log(`mark/measure → ${medida.duration.toFixed(1)}ms`);
performance.clearMarks(); // buffer não se esvazia sozinho
performance.clearMeasures();

// timerify — função que você não quer editar. Precisa de observer.
const cronometrada = performance.timerify(async () => esperar(30));
const obs = new PerformanceObserver((l) => {
  console.log(`timerify     → ${l.getEntries()[0]!.duration.toFixed(1)}ms`);
  obs.disconnect();
});
obs.observe({ entryTypes: ['function'] });
await cronometrada();

// monitorEventLoopDelay — "o processo está travado?". Nanossegundos: /1e6.
const h = monitorEventLoopDelay();
h.enable();
await esperar(30);
h.disable();
console.log(`loop delay   → ${(h.mean / 1e6).toFixed(1)}ms de atraso médio`);
