/**
 * Desafio extra: o mesmo relatório de duas formas.
 *
 * Rodar:  PRISMA_LOG=1 node exercicios/06-10/10-prisma/solucao/relatorios.ts
 */
import { prisma } from './db/prisma.ts';

type LinhaRelatorio = {
  autor: string;
  totalLivros: number;
  emprestados: number;
  anoMaisAntigo: number | null;
};

// =====================================================================
// FORMA 1 — API do Prisma
// =====================================================================
// Tipado de ponta a ponta, mas custa 2 queries (autores + agregação) e uma
// junção em JavaScript.
async function comPrisma(): Promise<LinhaRelatorio[]> {
  const [autores, agregado] = await prisma.$transaction([
    prisma.autor.findMany({
      select: {
        id: true,
        nome: true,
        _count: { select: { livros: true } },
      },
      orderBy: { nome: 'asc' },
    }),
    prisma.livro.groupBy({
      by: ['autorId'],
      _min: { ano: true },
      _count: { _all: true },
      where: { disponivel: false },
    }),
  ]);

  // `groupBy` com `where: { disponivel: false }` só conta os emprestados — então
  // o mínimo de ano viria só deles, o que não é o que queremos. Uma segunda
  // agregação seria necessária para o ano geral: já são 3 queries.
  const emprestadosPorAutor = new Map(agregado.map((g) => [g.autorId, g._count._all]));

  const anos = await prisma.livro.groupBy({ by: ['autorId'], _min: { ano: true } });
  const anoPorAutor = new Map(anos.map((g) => [g.autorId, g._min.ano]));

  return autores.map((a) => ({
    autor: a.nome,
    totalLivros: a._count.livros,
    emprestados: emprestadosPorAutor.get(a.id) ?? 0,
    anoMaisAntigo: anoPorAutor.get(a.id) ?? null,
  }));
}

// =====================================================================
// FORMA 2 — SQL cru
// =====================================================================
// UMA query, e a agregação condicional (`SUM(CASE WHEN ...)`) resolve os dois
// números de uma vez. Em troca, o tipo é uma PROMESSA sua: mudar a query e não
// mudar o generic não gera erro nenhum.
async function comSqlCru(): Promise<LinhaRelatorio[]> {
  // `$queryRaw` com template literal parametriza os `${}` — continua imune a
  // injeção. `$queryRawUnsafe` com entrada de usuário é que seria o problema.
  // Repare nos tipos: `COUNT`, `SUM` e `MIN` voltam como `bigint` no SQLite. Com
  // a API do Prisma isso não acontece — `_count` e `_min` já vêm como `number`.
  // É a tipagem que você perde ao descer para SQL cru: aqui o generic é uma
  // PROMESSA sua, e se você prometer `number` o TypeScript acredita e o
  // `JSON.stringify` explode em runtime com "Do not know how to serialize a BigInt".
  const linhas = await prisma.$queryRaw<
    {
      autor: string;
      total_livros: bigint;
      emprestados: bigint;
      ano_mais_antigo: bigint | null;
    }[]
  >`
    SELECT a.nome                                        AS autor,
           COUNT(l.id)                                   AS total_livros,
           SUM(CASE WHEN l.disponivel = 0 THEN 1 ELSE 0 END) AS emprestados,
           MIN(l.ano)                                    AS ano_mais_antigo
      FROM autores a
      LEFT JOIN livros l ON l.autor_id = a.id
     GROUP BY a.id
     ORDER BY a.nome
  `;

  // Conversão obrigatória: `JSON.stringify` de um bigint LANÇA TypeError. Sem
  // isto, esta função funcionaria no `console.table` e daria 500 numa rota.
  return linhas.map((l) => ({
    autor: l.autor,
    totalLivros: Number(l.total_livros),
    emprestados: Number(l.emprestados),
    anoMaisAntigo: l.ano_mais_antigo === null ? null : Number(l.ano_mais_antigo),
  }));
}

// =====================================================================
// VEREDICTO
// =====================================================================
//
// Eu manteria o SQL CRU neste caso, por três motivos:
//
//   1. É UMA query contra três. A diferença cresce com o número de autores.
//   2. `SUM(CASE WHEN ...)` expressa "conte só os emprestados" diretamente; na
//      API do Prisma isso exigiu duas agregações e dois Maps.
//   3. Relatório é leitura e não muda estrutura — o risco de o tipo divergir da
//      query é baixo, e um teste (módulo 12) cobre o que sobra.
//
// Manteria a API do Prisma se o relatório fosse filtrado por parâmetros variáveis
// do cliente (aí o `where` tipado ganha) ou se estivesse dentro de uma transação
// junto com escrita.
//
// A regra geral: o ORM para o CRUD (90% do código), SQL cru para agregação — e
// nunca por palpite, sempre depois de ver o número.

console.log('--- via API do Prisma ---');
console.table(await comPrisma());

console.log('\n--- via SQL cru ---');
console.table(await comSqlCru());

await prisma.$disconnect();
