# middlewares

Um **catálogo de middlewares prontos** para Express 5, um por pasta, cada um com
o código comentado e um README que diz o que ele resolve, onde ele entra na
pilha e **o que ele custa**.

## Como usar esta pasta

Ela é para **copiar**, não para importar. Nenhum `middleware.ts` daqui é
publicado como biblioteca, e nada no repositório depende dela — as soluções dos
exercícios continuam com as cópias próprias, porque o `diff` entre uma solução e
a seguinte é material de ensino.

A diferença entre copiar daqui e copiar de um tutorial é que a pasta vem com a
explicação junto: por que aquela linha existe, o que acontece se você tirá-la, e
qual é a armadilha que o código evita sem parecer que evita. Quem copia sem isso
descobre o problema em produção, que é exatamente onde ele custa caro.

O conceito de middleware — a ordem, a fábrica, os quatro argumentos do middleware
de erro — está em [`docs/01-05/05-middlewares.md`](../docs/01-05/05-middlewares.md). Este
catálogo não reexplica nada disso: ele aplica.

## Os quatro grupos

| Grupo                                                       | Porta | O que reúne                                                            |
| ----------------------------------------------------------- | ----- | ---------------------------------------------------------------------- |
| [`01-requisicao-e-resposta`](./01-requisicao-e-resposta/)   | 6101  | tempo de resposta, id de requisição, log                               |
| [`02-validacao-e-erros`](./02-validacao-e-erros/)           | 6102  | validar com schema, tratador central, 404, e o wrapper `async`         |
| [`03-acesso-e-seguranca`](./03-acesso-e-seguranca/)         | 6103  | autenticar, exigir papel, limitar requisições, cabeçalhos de segurança |
| [`04-desempenho-e-convencao`](./04-desempenho-e-convencao/) | 6104  | cache condicional com ETag, timeout, paginação                         |

Os 14 middlewares, e o que cada um existe para ensinar:

| Middleware                | Grupo | Módulo | O ponto                                                                                        |
| ------------------------- | ----- | ------ | ---------------------------------------------------------------------------------------------- |
| `tempo-de-resposta`       | 01    | 05     | em `res.on('finish')` os cabeçalhos já saíram; carimbar exige envolver `writeHead`             |
| `id-de-requisicao`        | 01    | 05     | log sem chave não se liga a nada — e o id que o cliente manda não é confiável                  |
| `log`                     | 01    | 14     | linha para humano × linha para máquina, e o que nunca pode entrar nela                         |
| `validar`                 | 02    | 07     | um middleware parametrizado para `body`, `params` e `query` — não três cópias                  |
| `tratador-de-erros`       | 02    | 06     | o Express reconhece o tratador **pela quantidade de argumentos**: apagar o `next` desliga tudo |
| `nao-encontrado`          | 02    | 06     | depois de todas as rotas, antes do tratador — e o que quebra em cada inversão                  |
| `assincrono`              | 02    | 06     | no Express 5 o wrapper virou desnecessário; a pasta prova isso e mostra o que ainda não é      |
| `autenticar`              | 03    | 11     | `jwt.verify`, nunca `jwt.decode` — a troca passa no teste manual e aceita token forjado        |
| `exigir-papel`            | 03    | 11     | autorizar é decisão separada de autenticar, e falha fechado                                    |
| `limitar`                 | 03    | 13     | a versão à mão mostra o mecanismo e o defeito da janela fixa; a biblioteca resolve o resto     |
| `cabecalhos-de-seguranca` | 03    | 13     | numa API JSON, metade dos cabeçalhos do helmet protege página que não existe                   |
| `cache-condicional`       | 04    | 15     | `304` sem corpo, e a etiqueta barata que evita montar a resposta — ao contrário da do Express  |
| `timeout`                 | 04    | 05     | você não mata o handler: ele continua rodando, você só para de responder                       |
| `paginacao`               | 04    | 05     | o teto recusa em vez de rebaixar em silêncio, porque rebaixar mente para o cliente             |

Metade usa assunto de módulo mais à frente (11, 13, 14) e um deles é de um módulo
que ainda não existe (15, cache). Cada pasta diz de qual módulo vem o conceito
principal; os grupos 01 e 02 se leem sabendo só o módulo 05.

## Rodar as demos

Cada grupo tem um `servidor.ts` que é **demonstração, não aplicação**: ele monta
a pilha daquele grupo e expõe rotas mínimas feitas para deixar cada efeito
visível num `curl`.

```bash
node middlewares/01-requisicao-e-resposta/servidor.ts   # porta 6101
node middlewares/02-validacao-e-erros/servidor.ts       # porta 6102
node middlewares/03-acesso-e-seguranca/servidor.ts      # porta 6103
node middlewares/04-desempenho-e-convencao/servidor.ts  # porta 6104
```

Sem instalação, sem build, sem variável de ambiente. Algumas rotas existem
**para falhar** — `/quebrado` no grupo 01, `/async/fora-da-pilha` no 02,
`/relatorio-sem-guarda` no 04 —, e é nelas que a armadilha de cada pasta aparece
acontecendo em vez de ser apenas descrita.

> **Atenção:** `curl -d '{"json":1}'` com aspas simples não funciona no
> PowerShell nem no `cmd.exe`. Use o Git Bash com `curl.exe`, ou troque as aspas
> conforme o aviso do módulo 01.

## Checar os tipos

```bash
npm run typecheck:mw
```

Esta pasta fica fora de `src/`, então o `npm run typecheck` não a enxerga. A
configuração está em `tsconfig.middlewares.json`, na raiz.

## O que não está aqui

Middleware de **upload** (módulo 19), de **compressão** e de **cache
distribuído** com Redis (módulo 15) ficaram de fora: os três dependem de
dependência que o repositório ainda não tem, e a regra desta pasta é não instalar
nada novo. O briefing de quem for acrescentar está em
[`ORQUESTRACAO.md`](./ORQUESTRACAO.md).
