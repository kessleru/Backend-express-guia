# 08.1 — O problema: a rota que faz tudo

**Em uma frase:** enquanto a regra de negócio mora dentro de um handler, ela não
tem endereço — e o que não tem endereço acaba sendo copiado.

[Índice do módulo](./README.md) · [Parte 2 — Cada camada →](./02-cada-camada.md)

<!-- sumario:inicio -->

**Sumário**

- [Um servidor que funciona](#um-servidor-que-funciona)
- [Onde dói: alguém precisa da mesma regra](#onde-dói-alguém-precisa-da-mesma-regra)
- [A mesma dor, em outros quatro lugares](#a-mesma-dor-em-outros-quatro-lugares)
- [O princípio](#o-princípio)
- [O custo, e quando tudo na rota é a escolha certa](#o-custo-e-quando-tudo-na-rota-é-a-escolha-certa)
- [O que vem a seguir](#o-que-vem-a-seguir)

<!-- sumario:fim -->

## Um servidor que funciona

Até o [módulo 07](../07-validacao-zod.md), todo exemplo tinha a mesma forma: um
`app.post(...)` com tudo dentro. Veja o handler que publica um curso, tirado de
[`01-tudo-na-rota/servidor.ts`](../../../src/exemplos/06-10/08-arquiteturas/01-tudo-na-rota/servidor.ts):

```ts
app.post('/api/v1/cursos/:id/publicar', (req, res) => {
  const curso = cursos.find((c) => c.id === Number(req.params.id));
  if (!curso) return res.status(404).json({ erro: 'Curso não encontrado' });

  // A REGRA DE PUBLICAR, na versão completa: duas condições.
  if (curso.publicado) return res.status(409).json({ erro: 'Curso já está publicado' });
  if (curso.horas < 2) {
    return res
      .status(400)
      .json({ erro: 'Curso precisa de ao menos 2h para ser publicado' });
  }

  curso.publicado = true;
  res.json(curso);
});
```

Este handler está **certo**. Ele responde 404, 409 e 400 nos casos certos, e a
regra de publicar — "não pode já estar publicado e precisa de pelo menos 2 horas"
— está completa.

Agora repare em quantos assuntos cabem nessas linhas: ler `req.params` (HTTP),
procurar no array (dados), conferir as duas condições (regra do negócio),
escolher entre 404, 409 e 400 (HTTP de novo), alterar o array (dados de novo).
Cinco assuntos misturados. Ainda não é um defeito — é uma observação que vai
importar daqui a pouco.

## Onde dói: alguém precisa da mesma regra

Meses depois chega o pedido: "precisamos de um botão que publique todos os
rascunhos de uma vez". A regra de publicar já existe... dentro do handler de
cima. E não dá para chamá-la: ela está grudada em `req.params` e em
`res.status`. Não existe uma função `publicar(curso)` para reusar.

O que sobra é copiar. Quem copia, com pressa, escreve isto:

```ts
// ❌ A cópia esqueceu a condição das 2 horas.
app.post('/api/v1/cursos/publicar-todos', (_req, res) => {
  const publicados: Curso[] = [];
  for (const curso of cursos) {
    if (!curso.publicado) {
      curso.publicado = true;
      publicados.push(curso);
    }
  }
  res.json({ publicados: publicados.length, cursos: publicados });
});
```

Rode e veja o bug acontecer:

```bash
node src/exemplos/06-10/08-arquiteturas/01-tudo-na-rota/servidor.ts
```

```bash
B=localhost:5081/api/v1/cursos
curl -X POST $B/3/publicar      # pela rota "certa"
curl -X POST $B/publicar-todos  # pela cópia
```

```text
{"erro":"Curso precisa de ao menos 2h para ser publicado"}
{"publicados":2,"cursos":[{"id":2,...},{"id":3,"titulo":"Curso relâmpago","horas":1,"publicado":true}]}
```

O "Curso relâmpago", de 1 hora, foi recusado por uma porta e aceito pela outra. O
sistema agora tem **duas versões da regra**, e elas discordam.

> **Atenção:** ninguém aqui escreveu código ruim de propósito. A pessoa que fez o
> `publicar-todos` não tinha como saber que existia uma segunda condição — ela
> estava escondida no meio de outro handler. O defeito é do **desenho**, que
> deixou a regra sem um lugar próprio.

## A mesma dor, em outros quatro lugares

A cópia da regra é o sintoma mais visível, mas não o único. Tudo abaixo vem da
mesma causa — os assuntos misturados no handler:

| Quando você precisa...                                         | Com tudo na rota                                                                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Testar "título repetido dá 409"                                | subir o Express e mandar HTTP de verdade, porque não existe função para chamar sozinha                                                    |
| Trocar o array por SQLite ([módulo 09](../09-sqlite-e-sql.md)) | mexer em **todos** os handlers — cada um tem o próprio `cursos.find`                                                                      |
| Usar a regra num script, num worker de fila                    | copiar, igual ao `publicar-todos`                                                                                                         |
| Mudar o formato do erro                                        | editar cada `res.status(...).json({ erro })` à mão — o que o [módulo 06](../06-tratamento-de-erros.md) já resolveu com o tratador central |

## O princípio

O que deu errado nos cinco casos tem uma causa só, e dá para dizer em frase
comum: **uma regra precisa de um endereço.** Um lugar só onde ela mora, de onde
qualquer um que precise dela — a rota, o botão de publicar todos, o teste, o
script — a chama em vez de reescrever.

O mesmo vale para os outros assuntos do handler. "Como os dados são guardados"
precisa de um endereço, para que trocar o array por SQLite seja mexer num lugar.
"Que status HTTP responder" precisa de outro, para que a regra não dependa de
existir HTTP.

Dar um endereço para cada assunto é, literalmente, o que se chama de
**arquitetura em camadas**. _Camada_ é só isso: um grupo de arquivos que cuida de
um assunto só e conversa com os outros grupos por funções bem definidas.

## O custo, e quando tudo na rota é a escolha certa

Separar não é de graça: são mais arquivos, e para entender uma requisição você
passa a abrir três ou quatro deles em vez de um.

Por isso, "tudo na rota" **não** é sempre errado. Um protótipo, um script de uma
tarde, uma API de três rotas sem regra nenhuma — nesses casos a separação custa e
não devolve nada. A [parte 5](./05-quando-nao-usar.md) mostra como decidir.

O que esta parte mostrou é o sinal de que chegou a hora: **no dia em que a mesma
regra for necessária em dois lugares**, ela precisa sair do handler.

## O que vem a seguir

A [parte 2](./02-cada-camada.md) pega esse mesmo servidor e dá um endereço para
cada assunto: rota, controller, service, repositório e domínio. A API continua
respondendo exatamente igual — o que muda é onde cada linha mora.

E para ver a regra com endereço resolvendo o `publicar-todos` de verdade, a
[parte 7](./07-clean-e-onion.md#a-prova-o-mesmo-publicar-todos) roda o mesmo
pedido numa versão separada em camadas: o curso de 1 hora é recusado, com o
motivo.

---

[Índice do módulo](./README.md) · [Parte 2 — Cada camada →](./02-cada-camada.md)
