# 08.8 — DDD: Domain-Driven Design

**Em uma frase:** DDD não é uma estrutura de pastas — é pôr o modelo do negócio no
centro do código, com as regras dentro dos objetos, e dividir um sistema grande
onde as palavras do negócio mudam de significado.

[← Parte 7 — Clean Architecture e Onion](./07-clean-e-onion.md) ·
[Índice](./README.md) · [Parte 9 — O que este repositório usa →](./09-o-que-este-repo-usa.md)

<!-- sumario:inicio -->

**Sumário**

- [O que DDD é, e o que ele não é](#o-que-ddd-é-e-o-que-ele-não-é)
- [Linguagem ubíqua: o código fala a língua do negócio](#linguagem-ubíqua-o-código-fala-a-língua-do-negócio)
- [A parte tática](#a-parte-tática)
- [A parte estratégica](#a-parte-estratégica)
- [Na prática](#na-prática)
- [O princípio](#o-princípio)
- [O custo](#o-custo)
- [O que isso muda no seu código](#o-que-isso-muda-no-seu-código)

<!-- sumario:fim -->

## O que DDD é, e o que ele não é

_Domain-Driven Design_ (design orientado ao domínio) é o nome do livro que Eric
Evans publicou em 2003. **Domínio** é o assunto de que o software trata — a
escola, a biblioteca, a seguradora —, com as regras e os termos de quem trabalha
nele.

A proposta, na descrição de Martin Fowler, é centrar o desenvolvimento num
**modelo do domínio** que entenda de verdade os processos e as regras do negócio,
e que viva **no código**, evoluindo junto, não num documento escrito antes.

O equívoco mais comum é achar que DDD é ter pastas `domain/`, `application/` e
`infrastructure/`. Pastas são o de menos. O DDD tem duas metades, e nenhuma delas
é sobre pastas:

- a **tática**: como escrever os objetos do domínio — entidade, value object,
  agregado;
- a **estratégica**: como dividir um sistema grande em partes, cada uma com o
  próprio modelo.

As duas começam pelo mesmo lugar: a linguagem.

## Linguagem ubíqua: o código fala a língua do negócio

**Linguagem ubíqua** ("presente em toda parte") é o vocabulário que o time de
desenvolvimento e as pessoas do negócio usam **igual** — na conversa, no quadro,
nos nomes do código.

Se a coordenação da escola diz "publicar o curso", o código tem um método
`publicar`, e não `setStatusAtivo(true)`. Se ela diz "carga horária", existe algo
chamado `CargaHoraria`, não `hrs`. A tradução mental entre "o que o negócio diz" e
"o que o código diz" é onde os mal-entendidos nascem, e a linguagem ubíqua elimina
a tradução.

Este repositório já faz isso, desde o módulo 03: `publicar`, `emprestar`,
`devolver`, `buscarPorTitulo`. É a parte do DDD que custa quase nada e que vale
em qualquer arquitetura.

## A parte tática

O exemplo desta seção é
[`src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/`](../../../src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/).

### O ponto de partida: o modelo anêmico

Olhe de novo para o `Curso` do exemplo principal:

```ts
// 08-camadas/dominio/curso.ts
export type Curso = { id: number; titulo: string; horas: number; publicado: boolean };
```

É um tipo só com dados. Toda a inteligência — pode publicar? pode remover? —
mora no service, que confere e depois manda gravar:

```ts
// 08-camadas/servicos/cursos.ts
if (curso.horas < HORAS_MINIMAS_PARA_PUBLICAR) throw requisicaoInvalida('...');
const atualizado = await repositorio.atualizar(id, { publicado: true });
```

Esse arranjo — objetos do domínio só com dados e as regras num service ao lado —
tem nome: **modelo anêmico** ("sem sangue"). Martin Fowler o chama de antipadrão
quando alguém diz estar fazendo DDD: você paga o custo de ter um modelo do
domínio, com seus tipos e arquivos, sem ganhar o benefício principal, que é a
regra morar junto do dado que protege.

Repare no risco concreto. Nada impede outro arquivo de chamar
`repositorio.atualizar(id, { publicado: true })` direto — e pular a regra das 2
horas. A regra está num lugar, mas o dado que ela protege aceita ser mudado de
qualquer outro.

### Entidade: o objeto com identidade e comportamento

A versão DDD põe a regra **dentro** do curso:

```ts
// 04-ddd-tatico/dominio/curso.ts
export class Curso {
  readonly id: number;
  #titulo: Titulo;
  #cargaHoraria: CargaHoraria;
  #publicado: boolean;

  publicar(): void {
    if (this.#publicado) throw new ErroDeDominio('conflito', 'Curso já está publicado');
    if (!this.#cargaHoraria.bastaParaPublicar()) {
      throw new ErroDeDominio('regra-violada', 'Curso precisa de ao menos 2h ...');
    }
    this.#publicado = true;
  }

  garantirQuePodeSerRemovido(): void {
    /* ... */
  }
}
```

O `#` antes do nome cria um campo **privado de verdade**: é JavaScript, não só
TypeScript, e nenhum código fora da classe consegue ler ou alterar
`#publicado`. O único caminho para publicar um curso é chamar `publicar()` — que
confere a regra antes. O risco do modelo anêmico acabou.

O `Curso` é uma **entidade**: um objeto que tem **identidade**. Dois cursos com o
mesmo título e as mesmas horas continuam sendo dois cursos, porque os `id` são
diferentes. O que define uma entidade é "quem ela é", não "o que ela contém".

Lado a lado, a diferença é onde a regra mora:

![À esquerda, o modelo anêmico: o service contém os ifs da regra e o Curso é só dados, então outro código pode chamar repo.atualizar e pular a regra. À direita, o modelo rico: o serviço de aplicação só carrega, pede curso.publicar() e salva, e o Curso guarda o campo privado e confere a regra dentro do método.](./img/anemico-vs-rico.svg)

### Value object: o valor que se valida sozinho

No modelo anêmico, `titulo` é uma `string`. Então "título válido" é uma promessa
que **cada lugar** do código precisa lembrar de cumprir. A versão DDD transforma o
título num objeto:

```ts
// 04-ddd-tatico/dominio/titulo.ts
export class Titulo {
  readonly valor: string;

  private constructor(valor: string) {
    this.valor = valor;
    Object.freeze(this);
  }

  static criar(bruto: string): Titulo {
    const valor = bruto.trim().replace(/\s+/g, ' ');
    if (valor.length < 3 || valor.length > 120) {
      throw new ErroDeDominio(
        'regra-violada',
        'Título precisa ter entre 3 e 120 caracteres',
      );
    }
    return new Titulo(valor);
  }

  igual(outro: Titulo): boolean {
    return this.valor.toLowerCase() === outro.valor.toLowerCase();
  }
}
```

Isso é um **value object** (objeto de valor), e ele tem três marcas, todas no
código acima:

1. **Se valida ao nascer.** O construtor é `private`, então a única porta é
   `Titulo.criar`, que valida. Se você tem um `Titulo` na mão, ele **é** válido —
   não existe `Titulo` inválido.
2. **É imutável.** `readonly` impede a alteração na compilação, e o
   `Object.freeze` impede em tempo de execução. Imutável quer dizer que dois
   cursos podem compartilhar o mesmo `Titulo` sem um alterar o do outro.
3. **Compara pelo valor.** Dois títulos com o mesmo texto **são** o mesmo título.
   Por isso existe `igual()`: o `===` entre dois objetos compara se são o mesmo
   objeto na memória, e daria `false` para dois `Titulo` de mesmo texto.

A terceira marca é o que separa value object de entidade: a entidade compara pelo
`id` (quem ela é); o value object compara pelo conteúdo (o que ele é). Dinheiro,
período entre duas datas, endereço e CPF são value objects clássicos.

O `CargaHoraria` segue o mesmo desenho e dá à regra das 2 horas um endereço com
nome — `carga.bastaParaPublicar()` — em vez de um `horas < 2` espalhado.

Uma consequência que aparece na API: o schema Zod deste exemplo confere só o
**formato** (é string? é número?). O tamanho do título saiu do schema e foi para o
value object, que vale em qualquer porta de entrada — não só no HTTP:

```bash
curl -X POST localhost:5084/api/v1/cursos -H 'Content-Type: application/json' -d '{"titulo":"ab","horas":5}'
```

```text
{"erro":"Título precisa ter entre 3 e 120 caracteres","status":400}
```

O custo aparece na mesma resposta: o erro do value object não traz o campo
`detalhes` com a lista de campos que o Zod monta nos outros exemplos. Ganhou-se
uma regra que vale em todo lugar; perdeu-se a mensagem por campo que o front
usa para pintar o formulário.

### Agregado: o conjunto que se guarda inteiro

O `Curso` tem dois value objects dentro. Os três formam um **agregado**: um grupo
de objetos tratados como uma unidade só, com uma entidade na frente — a **raiz do
agregado** — pela qual todo acesso passa.

As regras do agregado mudam o repositório:

```ts
// 04-ddd-tatico/dominio/repositorio.ts
export type RepositorioCursos = {
  proximoId(): Promise<number>;
  buscarPorId(id: number): Promise<Curso | null>;
  buscarPorTitulo(titulo: Titulo): Promise<Curso | null>;
  listar(filtro: { publicado?: boolean | undefined }): Promise<Curso[]>;
  salvar(curso: Curso): Promise<void>;
  remover(id: number): Promise<void>;
};
```

Repare no que **sumiu**: não existe mais `atualizar(id, dadosParciais)`. Em DDD o
agregado é **carregado inteiro**, alterado por um método dele, e **salvo
inteiro**. Quem decide o que muda é a entidade, não quem chama o repositório.

Um efeito colateral bom: a [pegadinha do update](./02-cada-camada.md#a-pegadinha-do-update)
— `undefined` apagando campo num spread — não tem onde acontecer, porque não há
mistura de dados parciais em lugar nenhum.

![O agregado Curso: uma fronteira tracejada contém a raiz Curso, com id e métodos, e dois value objects, Titulo e CargaHoraria. Por fora, o serviço de aplicação e o repositório só falam com a raiz. Uma seta vermelha riscada mostra que ninguém de fora altera um value object direto.](./img/agregado-curso.svg)

### Serviço de aplicação: fino de propósito

Com a regra dentro do curso, o service fica curto:

```ts
// 04-ddd-tatico/aplicacao/servico-cursos.ts
async publicar(id: number): Promise<Curso> {
  const curso = await carregar(id);
  curso.publicar(); // ← a regra inteira está atrás desta chamada
  await repositorio.salvar(curso);
  return curso;
},
```

Carregar, pedir ao objeto, salvar. Evans descreve essa camada assim: ela
**coordena** as tarefas e delega o trabalho aos objetos do domínio — não decide.

A exceção é instrutiva: "título não se repete" continua aqui. Um curso não
consegue saber se **outro** curso usa o mesmo título. Regra que precisa olhar o
conjunto não cabe dentro de um objeto — a mesma conclusão a que a
[parte 7](./07-clean-e-onion.md#círculo-2--casos-de-uso-as-operações-da-aplicação)
chegou por outro caminho.

### O falso amigo: `res.json(curso)`

Com a entidade rica, o jeito óbvio de responder compila e devolve **quase nada**:

```ts
res.json(curso); // ❌ responde {"id":1}
```

`JSON.stringify` — que o `res.json` usa por baixo — só enxerga as propriedades
**próprias e enumeráveis** do objeto. Os campos `#privados` não são propriedades,
e os getters `titulo` e `publicado` moram na classe, não no objeto. Sobra só o
`id`, que é campo público. O TypeScript não avisa, porque `res.json` aceita
qualquer coisa.

A correção é mapear na borda HTTP, de propósito:

```ts
// 04-ddd-tatico/http/rotas.ts
const paraJson = (curso: Curso) => ({
  id: curso.id,
  titulo: curso.titulo.valor,
  horas: curso.cargaHoraria.horas,
  publicado: curso.publicado,
});
```

É o mesmo papel do apresentador da [parte 7](./07-clean-e-onion.md), só que aqui
ele é obrigatório. E o mesmo mapeamento aparece do outro lado: o repositório
guarda uma "fotografia" em objeto simples (`curso.fotografar()`) e reconstrói a
entidade a cada busca (`Curso.reconstituir(foto)`). É o custo da entidade rica
que o modelo anêmico não tem.

## A parte estratégica

### Contexto delimitado: onde uma palavra muda de sentido

Pense na escola inteira, não só no catálogo. Para quem **monta** os cursos, um
curso tem título, carga horária e está publicado ou não. Para quem **matricula**,
um curso tem turmas, horários e vagas. Para o **financeiro**, tem preço,
descontos e nota fiscal.

É a mesma palavra, e são três coisas diferentes. A tentação é criar um `Curso`
único com todos os campos — e aí qualquer mudança que o financeiro precise obriga
a combinar com o catálogo e com a matrícula, porque o objeto é de todos.

O DDD propõe o contrário: dividir o sistema em **contextos delimitados** (_bounded
contexts_), cada um com o próprio modelo e a própria linguagem. Dentro de um
contexto, "curso" tem um significado só. Entre contextos, os modelos se conversam
por **tradução** — em geral, só o `id` atravessa a fronteira.

![Três contextos lado a lado: Catálogo, com Curso tendo título, carga horária e publicado; Matrícula, com Curso tendo turma, vagas e alunos inscritos; Financeiro, com Curso tendo preço, descontos e nota fiscal. Setas entre eles indicam que só o id do curso atravessa.](./img/contextos-delimitados.svg)

Fowler conta o caso de uma companhia de energia em que a palavra "medidor"
significava três coisas diferentes para três departamentos, e o software sofria
com isso. Onde a linguagem muda de um grupo de pessoas para outro, provavelmente
existe uma fronteira de contexto.

A biblioteca dos exercícios tem o mesmo fenômeno em escala pequena: "livro" no
acervo (título, ISBN, autor) não é o mesmo "livro" do empréstimo (exemplar, quem
pegou, prazo de devolução).

### Por que a estratégica importa mais

Fowler faz uma observação que vale guardar: a parte estratégica é conceitual — ela
funciona com qualquer linguagem, qualquer paradigma, qualquer framework. A parte
tática (classes, value objects) é a mais visível e a mais copiada, mas é a
estratégica que decide se um sistema grande continua mudável.

Um projeto com entidades ricas e value objects perfeitos, mas com um `Curso`
gigante compartilhado por três departamentos, não pegou a ideia principal.

## Na prática

A API responde igual à dos outros exemplos. O que muda é onde a regra mora:

```bash
node src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/servidor.ts
```

```bash
B=localhost:5084/api/v1/cursos
curl -X POST $B/2/publicar      # {"id":2,"titulo":"Express do zero","horas":8,"publicado":true}
curl -X POST $B/3/publicar      # {"erro":"Curso precisa de ao menos 2h para ser publicado","status":400}
curl -X DELETE $B/2             # {"erro":"Curso publicado não pode ser removido","status":409}
```

As três respostas vêm de métodos do `Curso` — `publicar()` e
`garantirQuePodeSerRemovido()` —, e não de `if` num service.

## O princípio

**A regra mora junto do dado que ela protege** — e, num sistema grande, **cada
parte do negócio tem o próprio modelo**, em vez de todos dividirem um só.

## O custo

| Ideia do DDD        | O que custa                                                      | Quando paga                                                                        |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Linguagem ubíqua    | quase nada                                                       | sempre                                                                             |
| Entidade rica       | classe, campos privados, mapear para JSON e para o banco         | quando há regras de estado (pode/não pode) que muitos lugares chamam               |
| Value object        | uma classe por conceito; mensagem de erro por campo mais difícil | quando o mesmo formato (CPF, dinheiro, período) aparece em vários lugares          |
| Agregado            | carregar e salvar o conjunto inteiro, mesmo para mudar um campo  | quando o conjunto tem regras que envolvem várias partes                            |
| Contexto delimitado | modelos duplicados e tradução entre eles                         | quando times ou departamentos diferentes usam a mesma palavra de jeitos diferentes |

DDD é ótimo para domínio complicado — seguro, logística, contabilidade —, em que a
regra **é** o produto. Para um CRUD com autenticação, o custo da parte tática não
retorna. A linguagem ubíqua retorna sempre.

## O que isso muda no seu código

- Mesmo sem DDD, use os nomes do negócio: `publicar`, não `setPublicado`.
- Quando a mesma validação de formato aparecer em três lugares, é o sinal para
  um value object.
- Quando um `if` de estado (pode publicar? pode cancelar?) for chamado de vários
  lugares, é o sinal para um método na entidade.
- Antes de reusar um tipo entre duas partes do sistema, pergunte se as duas usam
  a palavra do mesmo jeito.

---

[← Parte 7 — Clean Architecture e Onion](./07-clean-e-onion.md) ·
[Índice](./README.md) · [Parte 9 — O que este repositório usa →](./09-o-que-este-repo-usa.md)
