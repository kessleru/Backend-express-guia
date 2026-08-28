# Grupo 01 — requisição e resposta

📦 módulo 05 · 🔌 porta 6101

O que toda requisição ganha antes de chegar na rota, e o que a resposta leva de
volta. Os três são de diagnóstico: nenhum muda o que a API responde, e sem eles
não há como responder "por que estava lento" nem "o que aconteceu com aquela
requisição".

| Middleware                                  | O que faz                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`tempo-de-resposta`](./tempo-de-resposta/) | Carimba `X-Tempo-ms` na resposta, envolvendo `writeHead` — porque em `finish` já é tarde                   |
| [`id-de-requisicao`](./id-de-requisicao/)   | Dá um id a cada requisição, aceita o que o cliente mandar se o formato passar, e devolve em `X-Request-Id` |
| [`log`](./log/)                             | Uma linha JSON por requisição, com método, rota, status, duração e o id                                    |

Eles se encadeiam nessa ordem, e a ordem tem motivo: o primeiro só mede o que vem
depois dele, o segundo é a única fonte do id, e o terceiro lê o id que o segundo
deixou. Cada README explica a própria posição e o que quebra ao trocá-la.

Cada pasta é copiável sozinha — nenhum `middleware.ts` importa de outra pasta do
catálogo, e é por isso que a chave `'idDaRequisicao'` aparece escrita duas vezes.

## Rodar a demo

```bash
node middlewares/01-requisicao-e-resposta/servidor.ts
```

O `servidor.ts` é demonstração, não aplicação: ele monta a pilha dos três e expõe
quatro rotas mínimas, cada uma feita para deixar um efeito visível no `curl` ou
no terminal.

| Rota             | Para ver                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET /`          | O índice, com `X-Tempo-ms` e `X-Request-Id` nos cabeçalhos                                                           |
| `GET /lento/:ms` | O `X-Tempo-ms` crescer, e o log com `rota` (`/lento/:ms`) diferente de `caminho` (`/lento/120`)                      |
| `GET /eco`       | O id no corpo — e o que acontece ao mandar um `X-Request-Id` seu, válido ou malformado                               |
| `GET /quebrado`  | A armadilha: carimbar cabeçalho em `res.on('finish')`. A resposta sai **sem** `X-Tempo-ms` e o erro fica no terminal |

```bash
curl.exe -s -i http://localhost:6101/lento/120
curl.exe -s -i -H "X-Request-Id: meu-id-123" http://localhost:6101/eco
curl.exe -s -i http://localhost:6101/quebrado
```

> **Atenção:** rode pelo Git Bash, com `curl.exe`. No PowerShell, `curl` é apelido
> de `Invoke-WebRequest` e não entende estas opções.
