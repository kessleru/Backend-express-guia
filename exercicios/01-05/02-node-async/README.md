# Exercício 02 — Buscar 6 preços sem esperar em fila

⏱️ ~30 min · 🎯 Nível: iniciante

## Objetivo

Sentir na prática a diferença entre série e paralelo, e escrever tratamento de
erro assíncrono que realmente captura o erro.

## O que construir

Crie `src/playground/02-async/precos.ts`.

1. Uma função `buscarPreco(sku: string): Promise<number>` que simula uma API
   externa: espera **250 ms** e devolve um número. Se o `sku` começar com `X`,
   ela **lança** `new Error('SKU inexistente: ...')`.

   Use `setTimeout` de `node:timers/promises`:

   ```ts
   import { setTimeout as esperar } from 'node:timers/promises';
   ```

2. `buscarEmSerie(skus: string[])` — um `await` por volta de `for`.
3. `buscarEmParalelo(skus: string[])` — `Promise.all` + `map`.

   As duas devolvem `{ precos, ms }`, onde `ms` é o tempo que a função levou.

4. `buscarTolerante(skus: string[])` — usa `Promise.allSettled` e devolve
   `{ ok: Record<string, number>, falhas: string[] }`. Nenhum SKU inválido pode
   fazer a função inteira falhar.

5. Um bloco final que roda as três com
   `['A1','A2','A3','A4','A5','A6']` e imprime os tempos, e depois roda a
   tolerante com `['A1','X9','A3']`.

```mermaid
gantt
    title O que você deve medir (6 SKUs de 250 ms)
    dateFormat X
    axisFormat %L ms
    section Série
    A1 :0, 250
    A2 :250, 500
    A3 :500, 750
    A4 :750, 1000
    A5 :1000, 1250
    A6 :1250, 1500
    section Paralelo
    A1..A6 juntos :0, 250
```

Regras:

- Nenhum `any`. `catch` recebe `unknown` — estreite antes de usar.
- `npm run typecheck:play` tem que passar.

## Critérios de aceite

- [ ] `node src/playground/02-async/precos.ts` roda sem warning de rejeição
- [ ] Série com 6 SKUs → **~1500 ms**
- [ ] Paralelo com os mesmos 6 → **~250 ms**
- [ ] `buscarEmParalelo(['A1','X9'])` rejeita, e o `catch` de quem chamou pega
- [ ] `buscarTolerante(['A1','X9','A3'])` → 2 em `ok`, 1 em `falhas`
- [ ] Sem `Promise { <pending> }` em nenhuma saída
- [ ] `npm run typecheck:play` passa

## Dicas

<details><summary>Dica 1 — medir tempo</summary>

```ts
const inicio = Date.now();
// ...trabalho...
const ms = Date.now() - inicio;
```

Não precisa de biblioteca. `performance.now()` é mais preciso se você quiser.
</details>

<details><summary>Dica 2 — o erro clássico do paralelo</summary>

Isto é **série**, mesmo com `map`:

```ts
for (const sku of skus) precos.push(await buscarPreco(sku)); // espera cada uma
```

Paralelo é disparar todas **antes** de esperar qualquer uma:

```ts
const promessas = skus.map((sku) => buscarPreco(sku)); // já dispararam
const precos = await Promise.all(promessas);
```

`skus.map(async (sku) => ...)` devolve um array de Promises — precisa do
`Promise.all` em volta, senão você tem `Promise[]`, não `number[]`.
</details>

<details><summary>Dica 3 — allSettled</summary>

Cada resultado é um objeto discriminado por `status`:

```ts
for (const [i, r] of resultados.entries()) {
  if (r.status === 'fulfilled') ok[skus[i]!] = r.value;
  else falhas.push(skus[i]!);
}
```

O `!` é necessário por causa do `noUncheckedIndexedAccess`. Dentro do `if`, o
TypeScript sabe que `r.value` existe — é o discriminated union trabalhando.
</details>

<details><summary>Dica 4 — erro em unknown</summary>

```ts
catch (erro) {
  const msg = erro instanceof Error ? erro.message : String(erro);
}
```

`catch (erro: any)` compila, mas você perde exatamente a checagem que evita
`undefined is not a function` em produção.
</details>

## Desafio extra

Adicione `buscarComTimeout(sku, ms)` que desiste depois de `ms` milissegundos
usando `Promise.race`. Depois responda: a requisição original **para** de rodar
quando a race termina? (Não. Investigue `AbortController` — é assim que se
cancela de verdade.)

---

Terminou? Compare com [`solucao/precos.ts`](./solucao/precos.ts).
