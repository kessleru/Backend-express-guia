# Exercício 03 — API de biblioteca: CRUD de livros

⏱️ ~40 min · 🎯 Nível: iniciante

> **Importante:**
> 📚 **Aqui começa o projeto contínuo.** Tudo que você escrever daqui até o
> módulo 20 é a mesma API de biblioteca, crescendo. Guarde em
> `src/playground/biblioteca/`.

## Objetivo

Um CRUD completo de livros no Express, escolhendo o tipo de parâmetro e o status
code corretos em cada rota.

## O que construir

Crie `src/playground/biblioteca/servidor.ts` na porta **4030**.

Um livro:

```ts
type Livro = {
  id: number;
  titulo: string;
  autor: string;
  ano: number;
  disponivel: boolean; // começa true
};
```

Comece com 3 livros no array e implemente:

1. `GET /livros` — lista. Aceita, combináveis:
   - `?autor=texto` — autor **contém** o texto (sem diferenciar maiúscula)
   - `?disponivel=true` / `?disponivel=false`
   - `?ordenar=ano` ou `?ordenar=titulo` (crescente)
2. `GET /livros/:id` — um livro. Não existe → `404` `{ erro }`.
3. `POST /livros` — cria. Body: `titulo`, `autor`, `ano`. `disponivel` é `true` e
   **não** pode vir do cliente. Devolve `201` + `Location: /livros/<id>`.
4. `PATCH /livros/:id` — altera só os campos enviados.
5. `DELETE /livros/:id` — `204` sem corpo.
6. `POST /livros/:id/emprestar` — marca `disponivel: false`. Já emprestado →
   `409 Conflict`.
7. `POST /livros/:id/devolver` — marca `disponivel: true`.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Disponível: POST /livros
    Disponível --> Emprestado: POST /:id/emprestar
    Emprestado --> Disponível: POST /:id/devolver
    Emprestado --> Emprestado: emprestar de novo → 409
    Disponível --> [*]: DELETE → 204
```

Validação (dentro das rotas, na mão — é a dor que o módulo 07 vai curar):

- `titulo` e `autor`: string não vazia.
- `ano`: número inteiro entre 1450 e o ano atual.
- Body ausente ou campo faltando → `400` `{ erro: "mensagem clara" }`.

## Critérios de aceite

- [ ] `GET /livros` → `200` com os 3 livros
- [ ] `GET /livros?autor=tolkien` filtra sem diferenciar maiúscula
- [ ] `GET /livros?disponivel=false&ordenar=ano` combina filtro e ordenação
- [ ] `GET /livros/999` → `404` com `{ erro }`
- [ ] `POST` válido → `201`, header `Location`, `disponivel: true` no corpo
- [ ] `POST` com `{"disponivel": false}` → o livro criado ainda vem `true`
- [ ] `POST` com `ano: 1200` → `400`
- [ ] `POST` sem `Content-Type: application/json` → `400`, **não** `500`
- [ ] `PATCH /livros/1` com só `{"ano": 1955}` não apaga o título
- [ ] `DELETE /livros/1` → `204` sem corpo; repetir → `404`
- [ ] `POST /livros/2/emprestar` → `200`; repetir → `409`
- [ ] `POST /livros/2/devolver` → `200` e volta a `disponivel: true`
- [ ] `npm run typecheck:play` passa

## Dicas

<details><summary>Dica 1 — query param booleano</summary>

Não existe boolean na URL: `?disponivel=false` chega como a **string** `"false"`,
que é truthy em JavaScript. Comparar direto é o bug clássico:

```ts
if (req.query.disponivel) // verdadeiro até para "false"!
```

Compare com a string:

```ts
if (req.query.disponivel === 'true') resultado = resultado.filter((l) => l.disponivel);
else if (req.query.disponivel === 'false')
  resultado = resultado.filter((l) => !l.disponivel);
```

</details>

<details><summary>Dica 2 — ordenar sem estragar o array original</summary>

`sort` ordena **no lugar** — se você ordenar `livros` direto, muda o "banco".
Copie antes:

```ts
resultado = [...resultado].sort((a, b) => a.ano - b.ano);
```

Para string, `a.titulo.localeCompare(b.titulo)` respeita acento.
</details>

<details><summary>Dica 3 — ignorar campos que o cliente não pode mandar</summary>

Nunca faça `const livro = { id, ...req.body }`. Isso deixa o cliente escrever
qualquer campo — inclusive `disponivel`, ou um `id` que colide.

Monte o objeto campo por campo, escolhendo o que aceita:

```ts
const livro: Livro = { id: proximoId++, titulo, autor, ano, disponivel: true };
```

Esse é o mesmo princípio (não confiar na forma do input) que o Zod formaliza no
módulo 07 com `.strict()`.
</details>

<details><summary>Dica 4 — 409 Conflict</summary>

`400` é "o que você mandou está malformado". `409` é "sua requisição está
perfeita, mas o estado atual do recurso não permite" — exatamente emprestar um
livro já emprestado. Trocar um pelo outro faz o cliente tentar corrigir o body
para sempre.
</details>

<details><summary>Dica 5 — evitar o 500 sem Content-Type</summary>

No Express 5, sem o header o `req.body` é `undefined`, e desestruturar
`undefined` lança `TypeError` → `500`. Erro do cliente virando culpa sua:

```ts
const { titulo, autor, ano } = (req.body ?? {}) as Partial<Livro>;
```

</details>

## Desafio extra

Adicione paginação: `?pagina=2&porPagina=2`, devolvendo

```json
{ "dados": [...], "pagina": 2, "porPagina": 2, "total": 5 }
```

Note que isso muda o **formato** da resposta de `GET /livros` — de array para
objeto. Pense no custo disso para quem já consome sua API: é justamente o tipo de
mudança que motiva versionamento (módulo 04).

---

Terminou? Compare com [`solucao/servidor.ts`](./solucao/servidor.ts).
