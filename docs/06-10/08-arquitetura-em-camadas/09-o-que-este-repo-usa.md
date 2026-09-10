# 08.9 — O que este repositório usa

**Em uma frase:** camadas com a dependência do banco invertida — a ideia central
da Hexagonal e da Clean, sem as partes caras delas, e sem a parte tática do DDD.

[← Parte 8 — DDD](./08-ddd.md) · [Índice](./README.md) ·
[Parte 10 — Referência →](./10-referencia.md)

<!-- sumario:inicio -->

**Sumário**

- [O veredito](#o-veredito)
- [Pasta por pasta](#pasta-por-pasta)
- [A seta que aponta para fora](#a-seta-que-aponta-para-fora)
- [O que temos de cada uma, e o que falta de propósito](#o-que-temos-de-cada-uma-e-o-que-falta-de-propósito)
- [Vale ou não vale, em API pequena e média](#vale-ou-não-vale-em-api-pequena-e-média)
- [Como reconhecer a arquitetura de outro projeto](#como-reconhecer-a-arquitetura-de-outro-projeto)
- [Se o projeto crescer, o que entraria primeiro](#se-o-projeto-crescer-o-que-entraria-primeiro)
- [O princípio](#o-princípio)

<!-- sumario:fim -->

## O veredito

Se alguém perguntar "que arquitetura é essa?", a resposta precisa é:

> **Arquitetura em camadas** (rota → controller → service → repositório), com o
> repositório atrás de uma interface que mora no domínio. As regras moram nos
> services, e os objetos do domínio são só dados.

Com os nomes das partes 6 a 8:

- **É camadas**, no sentido de Fowler: apresentação, domínio e dados separados.
- **Tem a ideia central da Hexagonal e da Clean**: a seta do banco aponta para
  dentro. O repositório é uma porta de saída; o de memória, o SQLite e o Prisma
  são adaptadores.
- **Não é Hexagonal nem Clean por inteiro**: não há porta de entrada explícita,
  o erro carrega status HTTP, e não há um arquivo por caso de uso.
- **Não é DDD**: o domínio é anêmico — as regras estão nos services, não dentro
  dos objetos. Do DDD, fica a linguagem ubíqua.

## Pasta por pasta

As pastas do exemplo principal
([`src/exemplos/06-10/08-camadas/`](../../../src/exemplos/06-10/08-camadas/)), com o
nome que cada uma teria em cada arquitetura:

| Pasta aqui                  | O que faz aqui                   | Hexagonal                       | Clean                           | DDD                            |
| --------------------------- | -------------------------------- | ------------------------------- | ------------------------------- | ------------------------------ |
| `dominio/curso.ts`          | tipos + interface do repositório | núcleo (tipos) + porta de saída | entidades (sem regra) + gateway | modelo — **anêmico**           |
| `servicos/cursos.ts`        | **todas as regras**              | núcleo (lógica)                 | casos de uso, num arquivo só    | serviço de aplicação **gordo** |
| `controllers/cursos.ts`     | traduz HTTP ↔ service            | adaptador condutor              | adaptador (controller)          | camada de interface            |
| `rotas/`                    | URL + validação de formato       | adaptador condutor              | adaptador + framework           | camada de interface            |
| `repositorios/*-memoria.ts` | guarda e busca                   | adaptador conduzido             | adaptador (gateway concreto)    | repositório (infraestrutura)   |
| `servidor.ts`               | monta tudo                       | configuração                    | "main"                          | —                              |
| Express, Zod, Prisma        | ferramentas                      | fora dos adaptadores            | frameworks e drivers            | infraestrutura                 |

Posicionando nos círculos da parte 7:

![Os quatro círculos da Clean Architecture com as pastas do exemplo principal: dominio no centro, servicos no segundo círculo, rotas, controllers e repositorios no terceiro, e Express, Zod e Prisma por fora. Uma caixa vermelha AppError fica no círculo dos adaptadores, com uma seta tracejada saindo de servicos para ela, marcando a única dependência que aponta para fora.](./img/repo-nos-circulos.svg)

## A seta que aponta para fora

Quase todas as setas apontam para dentro. A exceção é a caixa vermelha: o service
lança `conflito()`, que cria um `AppError` com `status: 409`. O service não importa
nada de Express, mas escolhe um número que só faz sentido em HTTP.

É um **atalho consciente**, e vale entender o que ele compra e o que cobra.

**Compra:** nenhuma tradução de erro. O tratador central do
[módulo 06](../06-tratamento-de-erros.md) recebe o `AppError` e responde direto. Os
exemplos 02, 03 e 04 precisam de uma tabela `STATUS_POR_TIPO` e de um middleware a
mais para fazer a mesma coisa.

**Cobra:** o dia em que surgir um segundo adaptador de entrada que não fale HTTP —
um worker de fila no [módulo 17](../../16-20/17-jobs-e-filas.md), um comando de
terminal —, ele vai receber um erro com `status: 409` e ter que ignorar o número,
ou traduzi-lo de volta. É aí que vale fazer o que o
[exemplo hexagonal](./06-hexagonal.md#o-erro-que-não-sabe-o-que-é-http) faz: erro
com **tipo**, e cada adaptador com a própria tradução.

Enquanto o único adaptador de entrada for HTTP, o atalho economiza código sem
custar nada.

## O que temos de cada uma, e o que falta de propósito

| Ideia                                      | De onde vem             | Temos? | Por quê                                                                                 |
| ------------------------------------------ | ----------------------- | ------ | --------------------------------------------------------------------------------------- |
| Separar apresentação, regra e dados        | camadas (Fowler)        | ✅     | é o que resolve a parte 1                                                               |
| Regras numa camada de serviço              | Service Layer           | ✅     | um endereço para cada regra                                                             |
| Dependência do banco apontando para dentro | Hexagonal, Clean, Onion | ✅     | é barato, e os módulos 09 e 10 trocam o banco sem tocar no service                      |
| Composition root                           | todas                   | ✅     | trocar uma peça é mexer numa linha                                                      |
| Linguagem ubíqua                           | DDD                     | ✅     | custa nada; o código diz `publicar`, `emprestar`                                        |
| Porta de entrada como tipo explícito       | Hexagonal               | ➖     | `ServicoCursos` cumpre o papel, derivado com `ReturnType` em vez de escrito à mão       |
| Erro sem status HTTP                       | Hexagonal, Clean        | ❌     | atalho consciente — ver a seção anterior                                                |
| Um arquivo por caso de uso                 | Clean                   | ❌     | com poucas operações por recurso, viraria arquivos que só repassam                      |
| Apresentador                               | Clean                   | ❌     | o formato da API é igual ao do domínio; o DTO de entrada já basta                       |
| Entidade rica, value object, agregado      | DDD tático              | ❌     | as regras são poucas e simples; mapear classes para JSON e para o banco não compensaria |
| Contextos delimitados                      | DDD estratégico         | ❌     | é um sistema pequeno, com um modelo só                                                  |
| Pasta de cima por assunto                  | Screaming, Fowler       | ❌     | um domínio por exemplo; por camada técnica é o mais simples de navegar                  |

## Vale ou não vale, em API pequena e média

A tabela acima é sobre **este** repositório. Esta é a regra geral que ela segue:

| Ideia                           | Vale?                                            |
| ------------------------------- | ------------------------------------------------ |
| Dependência apontando p/ dentro | **Sim.** É o núcleo, e é barato.                 |
| Interface de repositório        | **Sim**, se você troca de banco ou testa isolado |
| Um arquivo por caso de uso      | Depende. Vira 60 arquivos de 8 linhas.           |
| Entidade rica, value object     | Só com domínio realmente complexo                |
| `IUsuarioRepositoryImpl`        | Não. É burocracia de nome.                       |
| Mapper entre 4 representações   | Raramente compensa                               |

O `IUsuarioRepositoryImpl` da tabela é um estilo de nome comum em projetos Java e
C#: `I` na frente para dizer "é interface", `Impl` no fim para dizer "é a
implementação". Em TypeScript, o tipo e a função já têm nomes diferentes
(`RepositorioCursos` e `criarRepositorioEmMemoria`), e o prefixo não diz nada que
o código já não diga.

## Como reconhecer a arquitetura de outro projeto

Os nomes das pastas enganam — há projetos com `domain/` que são anêmicos, e
projetos sem pasta nenhuma com esse nome que são hexagonais. Quatro perguntas
respondem melhor do que qualquer nome:

1. **O que o domínio importa?** Se importa ORM ou framework, a seta está para
   fora, seja qual for o nome da pasta.
2. **Onde está o `if` da regra?** Dentro do objeto (`curso.publicar()`) é modelo
   rico, estilo DDD. Num service ao lado é anêmico, estilo este repositório. Num
   handler é "tudo na rota".
3. **O núcleo sabe o que é HTTP?** Status code dentro de service ou de caso de
   uso quer dizer que só existe um adaptador de entrada em mente.
4. **Quantos arquivos de montagem existem?** Mais de um — API e worker, API e
   CLI — é sinal de hexagonal de verdade.

## Se o projeto crescer, o que entraria primeiro

Nenhuma das ausências da tabela é definitiva. Cada uma tem um gatilho:

| Quando acontecer...                                       | Adote                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------ |
| Surgir um worker de fila ou um comando que usa o service  | erro com tipo em vez de status (exemplo 02)                  |
| A mesma validação (CPF, dinheiro) aparecer em 3 lugares   | value object para ela (exemplo 04)                           |
| Um `if` de estado for chamado de vários services          | método na entidade (exemplo 04)                              |
| Um service passar de 15 métodos muito diferentes          | casos de uso em arquivos separados (exemplo 03)              |
| Surgirem vários domínios (cursos, matrículas, pagamentos) | pasta de cima por assunto, com as camadas dentro de cada uma |

## O princípio

Uma arquitetura não se escolhe inteira, como um pacote: **cada ideia se adota
quando o problema que ela resolve aparece.** O repositório adotou as que o
problema dele pediu, e a tabela de gatilhos diz quando adotar as outras.

---

[← Parte 8 — DDD](./08-ddd.md) · [Índice](./README.md) ·
[Parte 10 — Referência →](./10-referencia.md)
