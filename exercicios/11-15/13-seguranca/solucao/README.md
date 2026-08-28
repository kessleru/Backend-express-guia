# Solução do exercício 13 — o que mudou, e o que só foi provado

Esta pasta é a solução do módulo 12 depois das defesas do módulo 13. Como em
todo exercício do repositório, ela é uma **cópia da solução anterior** — o
`diff` é o material de estudo:

```bash
diff -rq exercicios/11-15/12-testes/solucao exercicios/11-15/13-seguranca/solucao
```

Rodar:

```bash
# Com banco (padrão) — exige setup uma vez:
npm run db:generate && npm run db:migrate && npm run db:seed
node --env-file=.env exercicios/11-15/13-seguranca/solucao/servidor.ts   # porta 4130

# Sem nenhum setup, com repositórios em memória:
REPO=memoria node --env-file=.env exercicios/11-15/13-seguranca/solucao/servidor.ts

npx vitest run exercicios/11-15/13-seguranca                             # 110 testes
```

## O que mudou de fato

| Arquivo                                     | Mudança                                                               |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `app.ts`                                    | `helmet()`, `cors` com lista de origens, limitadores montados         |
| `middlewares/limites.ts`                    | **novo** — quatro baldes por finalidade, com `express-rate-limit`     |
| `middlewares/limitar.ts`                    | **apagado** — o escrito à mão no módulo 05 saiu                       |
| `servicos/emprestimos.ts`                   | `buscarVisivel` fecha o IDOR; empréstimo de outro vira 404            |
| `rotas/emprestimos.ts`                      | `GET /emprestimos/:id` e `POST /emprestimos/:id/devolver`             |
| `servicos/arquivos.ts`                      | **novo** — resolve o caminho e o confina na pasta de capas            |
| `rotas/arquivos.ts`                         | **novo** — `GET /arquivos/:nome`                                      |
| `schemas/livro.ts`                          | `q` de busca, com teto de 100 caracteres                              |
| `testes/seguranca.test.ts`                  | cresceu de 7 para 25 casos                                            |
| `db/prisma.ts` + `repositorios/*-prisma.ts` | **novos** — a persistência real; memória vira dublê de teste          |
| `testes/repositorio.test.ts`                | **novo** — suíte de contrato: os mesmos casos contra memória e Prisma |

## O que já estava certo, e agora tem teste

O item 4 do enunciado (enumeração de usuário) **não exigiu correção**. O login
já respondia mensagem e status idênticos para "e-mail não existe" e "senha
errada" desde o módulo 11, e já gastava o tempo de um Argon2 nos dois caminhos
(`auth/senhas.ts`, `gastarTempoDeHash`).

O que faltava era o teste. A diferença importa: sem ele, a próxima pessoa a
mexer no login troca a mensagem por uma "mais útil" — `e-mail não cadastrado` —
e reabre a porta sem que nada fique vermelho. Código correto sem teste é código
correto **hoje**.

## Quatro coisas que o exercício pediu e a resposta foi diferente

### 1. `/emprestimos/:id` responde 404, mas `/livros/:id/devolver` continua 403

O enunciado pede 404 para o empréstimo de outra pessoa, e é o que está feito. A
rota de devolução por **livro**, que vem do módulo 11, continua com 403 — de
propósito.

O critério não é gosto: é o que o recurso já revela por outro caminho. O livro é
público, e `GET /livros/1` conta a qualquer um que ele existe e está emprestado —
o 403 ali não entrega nada novo, e informa melhor. O empréstimo é privado: o 403
seria a única fonte da informação "este empréstimo existe", e daria para varrer
`/emprestimos/1..500` contando as respostas.

O raciocínio inteiro está em `servicos/emprestimos.ts`.

### 2. O path traversal cru nem chega ao seu código

O critério de aceite aceita `400` **ou** `404` para `/arquivos/../../.env`, e o
motivo de os dois valerem fica claro rodando: as duas formas do ataque não param
no mesmo lugar.

| Requisição                 | Status | Quem barrou              |
| -------------------------- | ------ | ------------------------ |
| `/arquivos/../../.env`     | 404    | o **roteamento**         |
| `/arquivos/..%2f..%2f.env` | 400    | a sua defesa, no service |

`/:nome` casa com **um** segmento de caminho. A forma crua tem quatro, então o
Express nem chama o handler. O `%2f` não é barra para o roteador: casa com um
segmento, o Express decodifica ao montar `req.params`, e `../../.env` chega ao seu
código.

A armadilha: quem confere só a forma crua vê 404, conclui que está protegido e
nunca exercitou uma linha do próprio `resolverCapa`. Troque `/:nome` por `/*nome`
(wildcard, módulo 04) e a proteção imaginária desaparece sem nenhum teste ficar
vermelho.

> **Atenção:** reproduzindo com `curl`, o cliente **normaliza o `../` antes de
> enviar** — `curl localhost:4130/api/v1/arquivos/../../.env` manda
> `GET /api/.env`, e você mede outra coisa. Use `--path-as-is` para enviar o
> caminho como está escrito. O Supertest não normaliza, por isso o teste manda a
> forma crua direto.

### 3. A injeção de SQL: o payload de camiseta não é o que morde

O critério de aceite pede que a busca com `'; DROP TABLE livros; --` responda
`200` sem alterar nada. Ele passa — e a suíte de contrato
(`testes/repositorio.test.ts`) prova isso contra um **SQLite de verdade**, não
só contra o array em memória.

Mas rodando a versão vulnerável de propósito apareceu algo que muda o que dá
para afirmar: **o payload famoso não apaga a tabela nem quando o repositório é
vulnerável.** O `better-sqlite3` (como o `node:sqlite`) recusa executar mais de
uma instrução por consulta, e o `;` é justamente o que torna aquele payload duas.

Quem testa só com ele conclui que está protegido. Está protegido do payload de
camiseta, não de injeção.

O que passa é o payload de **uma instrução só**:

```
' OR 1=1 --
```

Ele fecha a aspa, neutraliza o filtro e comenta o resto. Numa consulta
concatenada devolve a **tabela inteira** — que é o que a maioria dos incidentes
reais de injeção é: vazamento, não destruição. Foi verificado: com
`$queryRawUnsafe`, este payload retorna todas as linhas.

Por isso o teste afirma as duas coisas — a busca não quebra, **e o filtro
continua filtrando**. E há um terceiro caso, do lado oposto: `O'Neill` é título
legítimo, e uma "defesa" que limpasse caracteres perigosos o recusaria ou
devolveria 500 para quem não fez nada de errado.

### 4. O `morgan` continua no `package.json`

Isso é do exercício 14, mas vale registrar aqui porque a mesma restrição vai
aparecer: este repositório tem **um** `package.json` para os 20 módulos, e o
exemplo do módulo 05 (`src/exemplos/01-05/05-middlewares/pilha.ts`) usa `morgan` para
mostrar um middleware de terceiros. Removê-lo quebraria aquele módulo.

Num projeto de verdade a instrução vale integralmente: dependência que não é mais
usada é peso morto e superfície de ataque.

## `npm audit --omit=dev` — o que apareceu e o que foi decidido

Rodado em 2026-08-18:

```
4 high severity vulnerabilities
```

| Pacote           | Gravidade | Chega até aqui por                   |
| ---------------- | --------- | ------------------------------------ |
| `deepmerge-ts`   | high      | `prisma` → `@prisma/config`          |
| `@prisma/config` | high      | `prisma`                             |
| `fast-uri`       | high      | `prisma` → `@prisma/dev` → … → `ajv` |
| `prisma`         | high      | direta (CLI do módulo 10)            |

**Decisão: nada a fazer agora.** O motivo, por extenso — porque "nada a fazer"
sem justificativa é o mesmo que não ter olhado:

As quatro entram pela **CLI do Prisma**, que é ferramenta de linha de comando
usada para gerar cliente e rodar migration. Ela não é importada por nenhum
arquivo que atende requisição: `grep -rn "from 'prisma'" src/` não acha nada. O
que a API usa é `@prisma/client`, que não está na lista.

Isso muda a conta de risco: a falha do `deepmerge-ts` é exaustão de pilha ao
mesclar objetos recursivos, e quem passa objeto para a CLI do Prisma é o próprio
arquivo de configuração do repositório, não um usuário anônimo. **Não existe
caminho de um dado do cliente até o código vulnerável.**

O que fica anotado, porque a decisão tem prazo de validade:

- Reavaliar quando o Prisma publicar uma versão com as transitivas atualizadas.
- `npm audit fix --force` foi **recusado**: ele rebaixaria o `prisma` para uma
  major anterior, o que quebraria o módulo 10 inteiro para consertar algo que não
  está exposto.

O ponto que o módulo 13 quer deixar: o valor do `npm audit` não é o número de
vulnerabilidades, é obrigar a resposta a duas perguntas — **isto roda no caminho
de uma requisição?** e **um dado do cliente chega até lá?**. Um alerta "high" sem
caminho de exploração é menos urgente que um "moderate" no seu parser de JSON.

## O que esta solução ainda não faz

Nada disto é preguiça: são defesas que exigem infraestrutura que ainda não entrou
no curso, e cada uma tem o seu módulo.

- **Rate limit compartilhado entre instâncias.** Os baldes vivem na memória do
  processo. Com três réplicas, o limite efetivo triplica. Precisa de Redis
  (módulo 15).
- **Limite por conta, além de por IP.** Ataque distribuído passa pelos cinco
  logins por minuto de cada bot.
- **`trust proxy`.** Atrás de um balanceador, `req.ip` vira o IP do proxy e todo
  mundo divide o mesmo balde — o rate limit vira negação de serviço contra os
  próprios usuários. A configuração depende de saber quantos proxies existem na
  frente, o que é assunto de deploy (módulo 16).
- **Validação de upload real.** A pasta de capas é lida, nunca escrita. Tipo real
  por magic bytes é o módulo 19.
- **Postgres.** O banco aqui é SQLite, por decisão do repositório (seção 3 do
  guia): zero instalação e SQL de verdade. Diferenças que o ORM **não** apaga já
  aparecem no código — `enum` que não existe no SQLite, `mode: 'insensitive'` que
  é ignorado em silêncio. Uma seção só de Postgres está planejada à parte.
