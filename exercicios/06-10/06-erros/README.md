# Exercício 06 — Erros centralizados na biblioteca

⏱️ ~35 min · 🎯 Nível: intermediário

> **Nota:**
> 📚 Continua o projeto. Você vai **remover** todos os
> `res.status(4xx).json(...)` das rotas — e a API vai ficar mais curta.

## Objetivo

Trocar tratamento de erro espalhado por um tratador central, com formato de
resposta único e nenhum vazamento de stack trace.

## O que construir

Adicione a `src/playground/biblioteca/`:

```
erros/
├── AppError.ts     # a classe + fábricas nomeadas
└── tratador.ts     # rotaNaoEncontrada + tratarErro
```

1. **`AppError.ts`** — classe com `mensagem`, `status`, `detalhes?` e as fábricas
   `naoEncontrado`, `requisicaoInvalida`, `conflito`, `semPermissao`.

2. **`tratador.ts`**:
   - `rotaNaoEncontrada` — chama `next(new AppError(..., 404))`, **não** responde.
   - `tratarErro(erro, req, res, next)` — 4 argumentos. Trata `AppError`,
     `SyntaxError` de JSON malformado, e qualquer outra coisa como 500 genérico.
   - Toda resposta de erro sai como
     `{ erro, status, requestId, detalhes? }`.
   - Bug (não-`AppError`) → `console.error` com o `requestId` no servidor,
     genérico para o cliente.

3. **Refatore as rotas** para lançar em vez de responder:
   - `router.param('id')` → `throw naoEncontrado('Livro', valor)`
   - validação → `throw requisicaoInvalida(msg, { campo })`
   - emprestar livro já emprestado → `throw conflito(...)`
   - deletar autor com livros → `throw conflito(...)`
   - `exigirChave` / `exigirPapel` → `throw naoAutenticado()` / `semPermissao()`

4. **Uma rota async que falha:** `GET /livros/:id/capa` espera 20 ms (simulando
   uma chamada externa) e então `throw new AppError('Serviço de capas
indisponível', 503)`.

5. **Uma rota com bug de propósito:** `GET /bug` que lê propriedade de
   `undefined`. Prove que o cliente **não** vê a stack.

6. `process.on('unhandledRejection')` e `uncaughtException` logando e saindo.

```mermaid
flowchart TD
    ROTA["rota / middleware / service"] -->|"throw"| EX["Express 5 captura<br/><i>inclusive em async</i>"]
    EX --> T{"tratarErro<br/>(4 argumentos)"}
    T -->|"AppError"| A["status do erro<br/>mensagem real"]
    T -->|"SyntaxError com .body"| B["400 · JSON inválido"]
    T -->|"qualquer outra coisa"| C["500 genérico ao cliente"]
    C -.->|"console.error"| LOG["stack completa no TERMINAL<br/>com o mesmo requestId"]
    style A fill:#bbf7d0,stroke:#16a34a,color:#000
    style B fill:#fed7aa,stroke:#ea580c,color:#000
    style C fill:#fecaca,stroke:#dc2626,color:#000
```

> **Cuidado:**
> O tratador precisa dos **4 argumentos**. Com 3, o Express o trata como
> middleware comum, e o cliente recebe HTML com a stack trace inteira.

## Critérios de aceite

- [ ] Nenhum `res.status(4` em `rotas/` nem em `middlewares/` (`grep` para conferir)
- [ ] `GET /api/v1/livros/999` → `404` `{ erro, status, requestId }`
- [ ] `POST` sem título → `400` com `detalhes: { campo: "titulo" }`
- [ ] `POST` com body `{quebrado` → `400`, **não** `500`
- [ ] Emprestar duas vezes → `409`
- [ ] `DELETE /autores/1` com livros → `409`
- [ ] `POST` sem chave → `401`; com chave e sem papel admin → `403`
- [ ] `GET /livros/1/capa` → `503` (rota **async**)
- [ ] `GET /bug` → `500` `{ erro: "Erro interno do servidor" }` sem `stack`
- [ ] O terminal mostra a stack completa do `/bug` com o mesmo `requestId`
- [ ] Depois de chamar `/bug` duas vezes, a API continua respondendo
- [ ] Todas as respostas de erro têm o mesmo conjunto de chaves
- [ ] `npm run typecheck:play` passa

## Dicas

<details><summary>Dica 1 — o tratador precisa dos 4 argumentos</summary>

```ts
export function tratarErro(
  erro: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {}
```

Remover o `next` — mesmo sem usar — faz o Express tratar isto como middleware
comum. O sintoma: em vez do seu JSON, o cliente recebe uma página HTML com a
stack trace inteira. Se `noUnusedParameters` reclamar, prefixe com `_`.
</details>

<details><summary>Dica 2 — detectar JSON malformado</summary>

O `express.json()` lança um `SyntaxError` com uma propriedade `body`:

```ts
if (erro instanceof SyntaxError && 'body' in erro) {
  return res.status(400).json({ erro: 'JSON inválido no corpo', status: 400 });
}
```

Sem esse bloco o cliente recebe 500 por ter mandado lixo — e você vai investigar
um bug seu que não existe.
</details>

<details><summary>Dica 3 — por que throw funciona em rota async agora</summary>

No Express 4 isto derrubava o processo inteiro:

```ts
app.get('/x', async () => {
  throw new Error('boom');
});
```

O router não dava `await` no retorno, então a Promise rejeitada virava
`unhandledRejection`. Era por isso que existia `express-async-errors`.

No Express 5 o router dá await. Não use wrapper — é código morto.
</details>

<details><summary>Dica 4 — o que NÃO mandar ao cliente</summary>

```ts
res.status(500).json({ erro: erro.message }); // ❌
```

Parece prestativo e é um vazamento. Mensagens reais que já apareceram em produção
por causa disso: `column "users"."password_hash" does not exist`,
`connect ECONNREFUSED 10.0.1.7:5432`, `ENOENT: /home/deploy/app/.env`. Cada uma
entrega um pedaço da sua infraestrutura.
</details>

<details><summary>Dica 5 — o grep do primeiro critério</summary>

```bash
grep -rn "res.status(4" src/playground/biblioteca/rotas src/playground/biblioteca/middlewares
```

Silêncio = passou. Depois da refatoração, os únicos `res.status` que sobram são o
`201`, o `204` e os do `tratador.ts`.
</details>

## Desafio extra

Faça o tratador incluir `stack` na resposta **só** quando
`process.env.NODE_ENV !== 'production'`. Rode com
`NODE_ENV=production node ...` e confirme que a stack desaparece. Depois pense:
qual é o risco de deixar isso ligado por engano — e como você garantiria em teste
automatizado (módulo 12) que a stack nunca vaza?

---

Terminou? Compare com [`solucao/`](./solucao/).
