# 08 — A mesma API em quatro arquiteturas

Material de apoio do módulo 08
([`docs/06-10/08-arquitetura-em-camadas/`](../../../../docs/06-10/08-arquitetura-em-camadas/README.md)).
O exemplo que mostra **o que o repositório usa** continua sendo
[`../08-camadas/`](../08-camadas/); estes quatro existem para comparação.

Todos implementam a mesma API de cursos, com os mesmos três cursos iniciais e as
mesmas regras (título único; publicar exige 2h e não pode repetir; publicado não
se remove). O que muda é **onde** cada coisa mora.

| Pasta             | Arquitetura                   | Porta | Onde a regra de publicar mora         | Parte do doc |
| ----------------- | ----------------------------- | ----- | ------------------------------------- | ------------ |
| `01-tudo-na-rota` | ❌ nenhuma (o jeito que dói)  | 5081  | dentro do handler — e numa cópia      | 1            |
| `02-hexagonal`    | portas e adaptadores          | 5082  | `nucleo/catalogo.ts`                  | 6            |
| `03-clean`        | quatro círculos, casos de uso | 5083  | `entidades/curso.ts`                  | 7            |
| `04-ddd-tatico`   | entidade rica, value objects  | 5084  | método `publicar()` da classe `Curso` | 8            |

## Rodar

```bash
node src/exemplos/06-10/08-arquiteturas/01-tudo-na-rota/servidor.ts
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/servidor.ts
node src/exemplos/06-10/08-arquiteturas/03-clean/servidor.ts
node src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/servidor.ts

# o hexagonal também roda sem servidor:
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts listar
node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 3
```

As portas 508N não colidem com nenhum outro exemplo, então dá para subir os
quatro juntos e mandar o mesmo `curl` para cada um.

## O experimento que vale fazer

`01-tudo-na-rota` e `03-clean` têm `POST /api/v1/cursos/publicar-todos`. No
primeiro, a regra foi copiada para dentro da rota nova e a cópia esqueceu a
condição das 2 horas. No segundo, a rota nova chama a mesma função que o
`publicar` usa:

```bash
curl -X POST localhost:5081/api/v1/cursos/publicar-todos   # publica o curso de 1h
curl -X POST localhost:5083/api/v1/cursos/publicar-todos   # recusa, com o motivo
```

## As diferenças que aparecem na resposta

- **Erro de validação do título.** Em 02 e 03, o Zod devolve `detalhes` com o
  campo. Em 04, quem recusa é o value object `Titulo`, e a mensagem vem sem
  `detalhes` — o preço de a regra valer em qualquer porta de entrada.
- **Formato do erro.** Em 01, cada handler escreve `{ erro }` à mão. Nos outros,
  o tratador central do módulo 06 monta `{ erro, status }`.
- **Log.** Em 02, o adaptador de console imprime `[aviso] curso publicado` a cada
  publicação — uma segunda porta de saída, além do repositório.
