# Grupo 04 — desempenho e convenção

Os middlewares que mexem no **custo da resposta** e os que padronizam o
**formato do pedido**. Nenhum deles muda o que a API faz; todos mudam quanto ela
cobra por fazer, ou quanto o cliente precisa adivinhar para pedir.

| Middleware                                  | O que faz                                                                     | O que muda no custo                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [`cache-condicional`](./cache-condicional/) | Emite `ETag` a partir de uma versão barata e responde `304` quando ela bate   | Corta o **trabalho inteiro**: o handler não roda e o corpo não é montado nem enviado       |
| [`timeout`](./timeout/)                     | Depois do prazo, para de esperar o handler e responde `503`                   | Corta a **espera do cliente**, e só ela. O handler continua rodando e custando o mesmo     |
| [`paginacao`](./paginacao/)                 | Lê `?pagina=&limite=`, valida com teto e entrega `pagina`, `limite`, `offset` | Põe um **teto** no custo da maior resposta possível: sem ele, `?limite=1000000` é legítimo |

Vale ler os três na ordem da tabela, porque eles vão do ganho maior ao menor —
e o terceiro é o único que ganha alguma coisa **sempre**, não só no caso bom.

## O ganho de cada um, e qual deles é medível

Duas dessas economias são fáceis de confundir com a terceira, e a demo existe
principalmente para separá-las.

O **timeout** não economiza nada do servidor. Isto é o ponto da pasta e
contraria a intuição de quase todo mundo: quando o prazo estoura, você para de
responder, mas não mata o handler — ele continua rodando, continua segurando a
conexão de banco, continua chegando ao fim para descobrir que não tem para quem
falar. A carga é idêntica com ou sem ele. O que ele protege é o cliente, que
deixa de esperar oito segundos por um erro.

A **paginação** também não economiza no caso comum: quem pede a página 1 com o
padrão paga o mesmo com ou sem middleware. O que ela faz é impedir o caso ruim
de existir. É seguro contra o pior pedido possível, não desconto no pedido
normal — e, de quebra, é a convenção que faz `?pagina=` significar a mesma coisa
em toda rota que lista.

O **cache condicional** é o único que corta trabalho de verdade, e é o único
cujo ganho dá para **medir sem acreditar em ninguém**. A demo tem um contador de
execuções por handler, e ele responde a pergunta que importa: quando a resposta
é `304`, o handler caro rodou?

Com o `ETag` que o Express gera sozinho, **rodou** — a etiqueta dele é calculada
sobre o corpo já montado, então o banco foi consultado e o JSON foi serializado
antes de o servidor concluir que nada mudou. Só a banda foi economizada. Com o
middleware, a etiqueta vem de um dado barato que já estava em memória, e o
`304` sai **antes** do `next()`: o contador não sobe.

```bash
$ curl.exe -s http://localhost:6104/execucoes
{"acervo":1,"acervoCaro":2}
```

Duas requisições em cada rota, uma delas com `If-None-Match`. As duas
responderam `304`. `acervoCaro: 2` é o handler tendo rodado nas duas;
`acervo: 1` é o handler que o middleware evitou. A diferença entre um ganho de
banda e um ganho de trabalho cabe nesse `1`.

## Como rodar a demo

```bash
node middlewares/04-desempenho-e-convencao/servidor.ts
```

Sobe na porta **6104**, sem banco e sem variável de ambiente. O acervo é um
array de 25 livros em memória.

| Rota                          | Para ver                                                                |
| ----------------------------- | ----------------------------------------------------------------------- |
| `GET /acervo`                 | `ETag` vindo do `atualizadoEm`, e `304` sem o handler rodar             |
| `GET /acervo-caro`            | A mesma resposta com o `ETag` automático do Express — o falso amigo     |
| `POST /livros/:id/emprestimo` | Muda a versão; a etiqueta antiga para de valer                          |
| `GET /livros`                 | `?pagina=` e `?limite=`, com o `422` acima do teto                      |
| `GET /relatorio`              | Handler de 3 s contra teto de 1,5 s, **com** a guarda `jaRespondida`    |
| `GET /relatorio-sem-guarda`   | O mesmo, sem a guarda: o cliente não vê diferença, o log do servidor vê |
| `GET /execucoes`              | O placar de quantas vezes cada handler realmente rodou                  |

O `timeout` da demo é de 1,5 s e não dos 5 s padrão, para caber num `curl` sem
paciência. Os `curl` de cada middleware, com a resposta real ao lado, estão na
seção `## Testado assim` do README de cada pasta.

> **Atenção:** no PowerShell e no `cmd.exe`, `curl` é um apelido para
> `Invoke-WebRequest` e as aspas simples dos exemplos não funcionam. Rode pelo
> Git Bash, e use `curl.exe` — é assim que os exemplos estão escritos.

## Onde eles entram na pilha

Os três ocupam posições diferentes, e nenhuma é intercambiável:

```ts
app.use(timeout(5000)); // global, primeiro — um teto parcial não é teto

app.get(
  '/acervo',
  cacheCondicional(() => acervo.atualizadoEm), // por rota, antes do handler
  handlerDoAcervo,
);

app.get('/livros', paginacao, handlerDaLista); // por rota, só nas que listam
```

O `timeout` é o único global: ele precisa cobrir tudo, inclusive os middlewares
que vêm depois. Os outros dois são por rota porque dependem do recurso — não
existe uma versão que sirva para o acervo e para o perfil do leitor ao mesmo
tempo, nem faz sentido paginar um `POST`.

O que é middleware, a ordem da pilha e a fábrica que recebe argumento estão em
[`docs/05-middlewares.md`](../../docs/05-middlewares.md). Os status usados aqui
(`304`, `422`, `503`) estão em
[`docs/01-fundamentos-http.md`](../../docs/01-fundamentos-http.md).

## O que este grupo não cobre

- **Cache do lado do servidor** — guardar a resposta pronta em memória ou Redis
  é outro assunto; aqui quem guarda é sempre o cliente.
- **Compressão** (`gzip`, `brotli`) — economiza banda em toda resposta, não só
  na repetida. É uma linha de `compression`, e uma dependência que este catálogo
  não instala.
- **Proteção contra carga.** Nenhum dos três reduz o número de requisições que
  chegam. Isso é [`limitar`](../03-acesso-e-seguranca/limitar/), no grupo 03.
