# Exercício 14 — Enxergando dentro da biblioteca

⏱️ ~40 min · 🎯 Nível: intermediário

> **Importante:**
> 🔭 Você vai trocar o logger da API e, principalmente, **provar com teste que a
> senha nunca aparece no log**. Esse teste é o entregável mais importante do
> exercício — foi ele que pegou um vazamento real no exemplo deste módulo.

## Objetivo

Substituir o `morgan` por Pino, costurar um request id por toda a stack e
garantir por teste que nada sensível vaza no log.

## O que construir

Partindo da sua solução do módulo 13:

```
biblioteca/
├── log.ts                    # ← NOVO: o logger, com nível e redact
├── app.ts                    # ← pino-http entra; morgan sai
├── servicos/
│   └── emprestimos.ts        # ← recebe o logger da requisição
├── rotas/
│   └── saude.ts              # ← NOVO: /health e /ready
└── testes/
    └── observabilidade.test.ts   # ← NOVO
```

### 1. O logger

Crie `log.ts` exportando um logger Pino com:

- Nível vindo de `process.env.LOG_LEVEL`, com `info` como padrão.
- `redact` cobrindo **os caminhos reais do seu payload**: senha, token,
  `authorization`, `cookie` — e os aninhados que você de fato usa.
- Em teste (`NODE_ENV=test`), nível `silent` — senão 113 testes despejam
  milhares de linhas e afogam a falha que importa (módulo 12).

### 2. `pino-http` no lugar do `morgan`

- Gere o request id reaproveitando `x-request-id` se o cliente mandou.
- Devolva o id no header da resposta.
- `customLogLevel`: 5xx → `error`, 4xx → `warn`, resto → `info`.

Remova o `morgan` do `package.json` depois — dependência que não é mais usada é
peso morto (e superfície de ataque, módulo 13).

### 3. O id descendo pela stack

O `req.log` precisa chegar ao service e ao repositório. Não use variável global:
passe como argumento, do mesmo jeito que o repositório é injetado (módulo 08).

```ts
// controller
const emp = await servico.criar(dados, req.log);

// service
async criar(dados: NovoEmprestimo, log: Logger) {
  log.info({ livroId: dados.livroId }, 'criando empréstimo');
}
```

### 4. Health e ready

- `GET /health` → `200` sempre que o processo estiver vivo. **Não toque no banco.**
- `GET /ready` → `200` se o banco responde; `503` se não.

### 5. Os testes

Escreva pelo menos estes:

1. A resposta traz `x-request-id`.
2. O id mandado pelo cliente é reaproveitado (não sobrescrito).
3. Um erro 500 é logado com `level: 50` e com a stack.
4. **A senha não aparece no log** — nem no corpo, nem em header.
5. `/health` continua `200` com o banco fora; `/ready` responde `503`.

## Critérios de aceite

- [ ] `morgan` não aparece mais no `package.json` nem no código
- [ ] Toda resposta traz o header `x-request-id`
- [ ] `x-request-id` enviado pelo cliente é reaproveitado no log e na resposta
- [ ] O log do service sai com o mesmo id do log da requisição
- [ ] `GET /livros/999` gera log com `level: 40` (warn)
- [ ] Uma rota que lança gera log com `level: 50` e `err.stack` preenchido
- [ ] A resposta de erro **não** contém a stack (regra do módulo 06)
- [ ] Teste prova que a senha não aparece em nenhum lugar do log
- [ ] Teste prova que `authorization` sai como `[REDACTED]`
- [ ] `LOG_LEVEL=debug` mostra logs que não aparecem com `info`
- [ ] `/health` responde `200` sem tocar no banco
- [ ] `/ready` responde `503` quando o banco está indisponível
- [ ] `npm test` continua verde e silencioso (sem enxurrada de log)
- [ ] `npm run typecheck` limpo

## Dicas

<details><summary>Dica 1 — o import do pino-http</summary>

Com `verbatimModuleSyntax`, o import **default** do `pino-http` não é chamável
(`This expression is not callable`), porque o pacote é CommonJS. Use o export
nomeado:

```ts
import { pinoHttp } from 'pino-http'; // ✅
import pinoHttp from 'pino-http'; // ❌ TS2349
```

</details>

<details><summary>Dica 2 — os callbacks não são inferidos</summary>

`genReqId` e `customLogLevel` recebem os tipos do `node:http`, não do Express, e
o `tsc` acusa `TS7006` se você não anotar:

```ts
type ReqHttp = import('node:http').IncomingMessage;
type ResHttp = import('node:http').ServerResponse;

genReqId: (req: ReqHttp, res: ResHttp) => { ... }
```

</details>

<details><summary>Dica 3 — silenciar o log nos testes</summary>

```ts
export const log = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.LOG_LEVEL ?? 'info'),
  redact: { paths: [...], censor: '[REDACTED]' },
});
```

Mas atenção: com `silent` você não consegue **testar** o log. Para os testes de
redação, crie um logger específico que escreve num destino em memória (dica 5).

</details>

<details><summary>Dica 4 — a pegadinha do redact</summary>

`redact: ['senha']` cobre `{ senha }` no topo. Não cobre `{ corpo: { senha } }`
nem `{ usuario: { credenciais: { senha } } }`.

Se você logar o corpo inteiro em algum lugar, o caminho muda — e o vazamento
volta sem aviso. Liste os caminhos reais e use `'*.senha'` para um nível de
aninhamento. **Depois escreva o teste**, porque a lista vai se desatualizar.

</details>

<details><summary>Dica 5 — capturar o log dentro do teste</summary>

O jeito mais simples é um stream em memória:

```ts
import { Writable } from 'node:stream';

function loggerDeTeste() {
  const linhas: string[] = [];
  const destino = new Writable({
    write(chunk, _enc, cb) {
      linhas.push(String(chunk));
      cb();
    },
  });
  const log = pino({ redact: { paths: [...], censor: '[REDACTED]' } }, destino);
  return { log, linhas };
}

it('não vaza a senha', async () => {
  const { log, linhas } = loggerDeTeste();
  const app = criarApp({ ...deps, log });
  await request(app).post('/auth/login').send({ email: 'a@b.c', senha: 'SENHA_SECRETA' });
  expect(linhas.join('')).not.toContain('SENHA_SECRETA');
  expect(linhas.join('')).toContain('[REDACTED]');
});
```

</details>

<details><summary>Dica 6 — por que /health não pode checar o banco</summary>

Porque o orquestrador trata a falha de `/health` como "processo travado" e
**reinicia** o container. Se o `/health` checa o banco e o banco cai, você entra
num loop de reinício que não conserta o banco e ainda derruba as requisições que
estavam em andamento.

`/ready` falhando só tira a instância do balanceador — que é o comportamento
correto quando a dependência está fora.

</details>

<details><summary>Dica 7 — provar que o id costura a stack</summary>

Mande um id conhecido e confira que ele aparece nos logs de **todas** as
camadas:

```ts
await request(app).get('/livros/1').set('x-request-id', 'costura-1');

const eventos = linhas.map((l) => JSON.parse(l));
const doService = eventos.filter((e) => e.msg === 'livro encontrado');
expect(doService.length).toBeGreaterThan(0);
expect(doService.every((e) => (e.reqId ?? e.req?.id) === 'costura-1')).toBe(true);
```

O `?? e.req?.id` está aí porque o `pino-http` põe o id em `req.id` na linha da
requisição e em `reqId` nos logs filhos — vale conferir onde caiu no seu caso.

</details>

## Desafio extra

Meça o **p95** do tempo de resposta a partir dos seus próprios logs: dispare 200
requisições, colete o campo de duração, ordene e pegue o valor na posição 95%.
Compare com a média — e veja com os próprios olhos o que a média escondia.

Se quiser ir além: acrescente um endpoint `/metricas` que expõe Rate, Errors e
Duration acumulados desde o boot, no formato que o Prometheus lê
(`nome{rótulo="valor"} número`, uma métrica por linha).
