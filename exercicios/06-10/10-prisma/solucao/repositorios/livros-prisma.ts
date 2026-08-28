/**
 * `RepositorioLivros` sobre Prisma.
 *
 * Compare com `exercicios/06-10/09-sqlite/solucao/repositorios/livros-sqlite.ts`:
 * sumiram a conversão `snake_case`→`camelCase`, a `0/1`→boolean, o `WHERE`
 * montado em string e o `SET` montado em string. O que sobra é o mapeamento da
 * junção de gêneros, que é consequência de ter escolhido N-N explícito.
 */
import type {
  AtualizacaoLivro,
  FiltroLivros,
  Genero,
  Livro,
  NovoLivro,
  Pagina,
  RepositorioLivros,
} from '../dominio/livro.ts';
import { prisma } from '../db/prisma.ts';

/**
 * O que o Prisma devolve com `include: { generos: { include: { genero: true } } }`.
 *
 * A navegação em dois níveis (`generos[].genero.nome`) é o preço do N-N
 * explícito. Com N-N implícito seria `generos[].nome`, mas não daria para
 * acrescentar coluna na junção depois.
 */
type LivroDoPrisma = {
  id: number;
  titulo: string;
  ano: number;
  isbn: string | null;
  disponivel: boolean;
  autorId: number;
  generos: { genero: { nome: string } }[];
};

const paraLivro = (l: LivroDoPrisma): Livro => ({
  id: l.id,
  titulo: l.titulo,
  autorId: l.autorId,
  ano: l.ano,
  disponivel: l.disponivel, // já é boolean: o Prisma converteu
  generos: l.generos.map((lg) => lg.genero.nome as Genero),
  // `exactOptionalPropertyTypes`: a chave só existe se houver valor.
  ...(l.isbn !== null ? { isbn: l.isbn } : {}),
});

/** Um objeto, reusado em todas as queries: uma fonte de verdade para o include. */
const COM_GENEROS = { generos: { include: { genero: true } } } as const;

export function criarRepositorioLivrosPrisma(): RepositorioLivros {
  return {
    async listar(filtro: FiltroLivros): Promise<Pagina<Livro>> {
      // O `where` é um objeto tipado — `autorld` (com L) é erro de compilação.
      const where = {
        ...(filtro.autorId !== undefined ? { autorId: filtro.autorId } : {}),
        ...(filtro.disponivel !== undefined ? { disponivel: filtro.disponivel } : {}),
      };

      const orderBy =
        filtro.ordenar === 'ano'
          ? { ano: 'asc' as const }
          : filtro.ordenar === 'titulo'
            ? { titulo: 'asc' as const }
            : { id: 'asc' as const };

      // As duas queries na MESMA transação: assim o `total` corresponde
      // exatamente ao conjunto de onde a página saiu. Fora da transação, um
      // INSERT concorrente entre elas daria um total que não bate com os dados.
      const [total, livros] = await prisma.$transaction([
        prisma.livro.count({ where }),
        prisma.livro.findMany({
          where,
          // UM include traz os gêneros de TODOS os livros da página. Um laço com
          // `await` aqui dentro seria o N+1 clássico — e o número de queries
          // cresceria com o número de livros.
          include: COM_GENEROS,
          orderBy,
          take: filtro.porPagina,
          skip: (filtro.pagina - 1) * filtro.porPagina,
        }),
      ]);

      return {
        dados: livros.map(paraLivro),
        pagina: filtro.pagina,
        porPagina: filtro.porPagina,
        total,
      };
    },

    async listarDisponiveis() {
      const livros = await prisma.livro.findMany({
        where: { disponivel: true },
        include: COM_GENEROS,
        orderBy: { titulo: 'asc' },
      });
      return livros.map(paraLivro);
    },

    async buscarPorId(id: number) {
      // `findUnique` devolve `null` quando não acha — encaixa direto na
      // interface. `findUniqueOrThrow` seria o contrário: lançaria.
      const livro = await prisma.livro.findUnique({
        where: { id },
        include: COM_GENEROS,
      });
      return livro ? paraLivro(livro) : null;
    },

    async buscarPorIsbn(isbn: string) {
      // Só funciona com `findUnique` porque `isbn` é `@unique` no schema.
      const livro = await prisma.livro.findUnique({
        where: { isbn },
        include: COM_GENEROS,
      });
      return livro ? paraLivro(livro) : null;
    },

    async contarPorAutor(autorId: number) {
      // COUNT roda no banco. `findMany().length` traria todas as linhas para a
      // memória do Node só para contá-las.
      return prisma.livro.count({ where: { autorId } });
    },

    async criar(dados: NovoLivro) {
      // NESTED CREATE: insere em `livros` e em `livros_generos` numa transação
      // implícita. É o BEGIN/COMMIT que escrevemos à mão no exercício 09.
      //
      // `connect` liga a um gênero que já existe (catálogo fixo); `create`
      // criaria um novo.
      const livro = await prisma.livro.create({
        data: {
          titulo: dados.titulo,
          ano: dados.ano,
          autorId: dados.autorId,
          ...(dados.isbn !== undefined ? { isbn: dados.isbn } : {}),
          generos: {
            create: dados.generos.map((nome) => ({ genero: { connect: { nome } } })),
          },
        },
        include: COM_GENEROS,
      });
      return paraLivro(livro);
    },

    async atualizar(id: number, dados: AtualizacaoLivro) {
      try {
        // Transação INTERATIVA: a substituição dos gêneros depende do update ter
        // dado certo. Note o `tx` em toda operação — usar `prisma` aqui sairia da
        // transação e o rollback não desfaria nada. É um bug silencioso e caro.
        const livro = await prisma.$transaction(async (tx) => {
          if (dados.generos !== undefined) {
            // Substituição completa em vez de calcular a diferença: mais simples,
            // e a tabela de junção de um livro tem 3 linhas no máximo.
            await tx.livroGenero.deleteMany({ where: { livroId: id } });
          }

          return tx.livro.update({
            where: { id },
            data: {
              // Spread condicional por causa do `exactOptionalPropertyTypes`:
              // os tipos gerados declaram `titulo?: string`, sem `| undefined`,
              // e a flag recusa chave presente valendo `undefined`.
              ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
              ...(dados.ano !== undefined ? { ano: dados.ano } : {}),
              ...(dados.autorId !== undefined ? { autorId: dados.autorId } : {}),
              ...(dados.isbn !== undefined ? { isbn: dados.isbn } : {}),
              ...(dados.disponivel !== undefined ? { disponivel: dados.disponivel } : {}),
              ...(dados.generos !== undefined
                ? {
                    generos: {
                      create: dados.generos.map((nome) => ({
                        genero: { connect: { nome } },
                      })),
                    },
                  }
                : {}),
            },
            include: COM_GENEROS,
          });
        });

        return paraLivro(livro);
      } catch {
        // `update` de id inexistente lança P2025; a interface pede `null`.
        return null;
      }
    },

    async remover(id: number) {
      try {
        // As linhas de `livros_generos` somem sozinhas: `onDelete: Cascade`.
        await prisma.livro.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };
}
