# Grupo 02 — validação e erros

🧩 grupo 02 · 🔌 porta 6102 · 📦 módulos 06 e 07

O grupo que decide **o que a API responde quando o pedido não presta**. Os quatro
middlewares aqui não têm nada a ver uns com os outros no que fazem, e tudo a ver
no resultado: qualquer recusa desta API sai no mesmo `{ erro, status }`, seja o
campo malformado, o endereço inexistente, o recurso que não existe ou o bug que
ninguém previu.

Essa unidade não é enfeite. Do outro lado da API alguém escreve **um** tratamento
de erro — e um formato que diverge por rota vira um `if` por endpoint, com o `if`
que faltar mostrando tela em branco em vez de mensagem.

## Os middlewares

| Pasta                                       | O que faz                                                                                                        | Status que ele produz |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------- |
| [`validar`](./validar/)                     | Confere `body`, `params` ou `query` contra um schema Zod e devolve a lista dos campos que falharam               | **422**               |
| [`nao-encontrado`](./nao-encontrado/)       | Fecha a pilha: nenhuma rota casou, então lança em vez de deixar o Express responder HTML                         | **404**               |
| [`assincrono`](./assincrono/)               | A pasta que diz **não escreva isto** — o `asyncHandler` é desnecessário no Express 5. E o que ainda é necessário | —                     |
| [`tratador-de-erros`](./tratador-de-erros/) | O último da pilha: transforma qualquer erro na resposta JSON de formato único                                    | o do erro, ou **500** |

Uma ordem de leitura que ajuda: `tratador-de-erros` primeiro, porque os outros
três terminam nele. Depois `validar`, `nao-encontrado` e `assincrono` em qualquer
ordem.

## A ordem na pilha

É o conteúdo do grupo tanto quanto o código de cada pasta. As duas últimas linhas
não são estilo:

```ts
app.use(express.json());

app.post('/chamados', validar(criarChamadoSchema), handler); // validar: por rota
app.get('/chamados/:id', validar(idSchema, 'params'), handler);

app.use(rotaNaoEncontrada); // depois de TODAS as rotas
app.use(tratadorDeErros); // sempre, sempre o último
```

Cada README traz o que quebra ao inverter a sua linha. As duas inversões que mais
acontecem: registrar uma rota **depois** do `rotaNaoEncontrada` (só as rotas
novas dão 404, sem erro nenhum no log) e registrar o `tratadorDeErros` **antes**
dele (o status continua 404 e o corpo volta a ser HTML com a stack dentro).

## Rodar a demo

```bash
node middlewares/02-validacao-e-erros/servidor.ts
```

```
Demo do grupo 02 em http://localhost:6102
```

O `servidor.ts` é demonstração, não aplicação: ele monta a pilha completa e expõe
as rotas mínimas para cada middleware aparecer num `curl` — incluindo as que
falham de propósito.

| Rota                            | Para que serve                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `POST /chamados`                | validação de corpo: 201, ou 422 com a lista de campos       |
| `GET /chamados?pagina=&limite=` | validação de query, com `z.coerce`                          |
| `GET /chamados/:id`             | validação de params, e o 404 de recurso inexistente         |
| `GET /falha-inesperada`         | erro que ninguém previu: 500 genérico, stack só no log      |
| `GET /async/com-wrapper`        | rota `async` com o `asyncHandler` de sempre                 |
| `GET /async/sem-wrapper`        | **a mesma rota sem wrapper nenhum** — mesma resposta        |
| `GET /async/fora-da-pilha`      | `throw` dentro de `setTimeout`, o caso que não é automático |
| qualquer outra                  | o 404 de rota inexistente                                   |

> **Atenção — aspas no Windows:** os `curl` com corpo JSON dos READMEs usam
> aspas simples, que funcionam no **Git Bash**, no Linux e no macOS. O `cmd.exe`
> e o PowerShell não removem aspas simples e o corpo chega literalmente como
> `'{"a":1}'`; nesses dois, escape as aspas duplas — `-d "{\"a\":1}"`.

## Para estudar

- [05 — Middlewares](../../docs/01-05/05-middlewares.md): o que é middleware, a ordem
  da pilha, a fábrica e os 4 argumentos do tratador de erro.
- [06 — Tratamento de erros](../../docs/06-10/06-tratamento-de-erros.md): `AppError`,
  `throw` em vez de `res.status`, o que mudou no Express 5 e a rede de segurança
  do processo.
- [07 — Validação com Zod](../../docs/06-10/07-validacao-zod.md): schema, `safeParse` e
  a diferença entre validação e regra de negócio.
