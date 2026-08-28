/**
 * Queries do Prisma, o problema N+1 e transações.
 *
 * Rodar com o SQL visível (recomendado):
 *   PRISMA_LOG=1 node src/exemplos/06-10/10-prisma/01-queries.ts
 *
 * O log é o material didático deste arquivo: você CONTA as queries.
 */
import { prisma } from './db.ts';

function titulo(t: string) {
  console.log(`\n${'─'.repeat(62)}\n${t}\n${'─'.repeat(62)}`);
}

// =====================================================================
titulo('1. Queries básicas — tipadas de ponta a ponta');
// =====================================================================

const todos = await prisma.livro.findMany({ orderBy: { ano: 'asc' } });
console.log(`findMany: ${todos.length} livros`);

// `findUnique` só aceita campo único. Para os outros, `findFirst`.
const hobbit = await prisma.livro.findUnique({ where: { id: 1 } });
console.log('findUnique(1):', hobbit?.titulo);

// O `where` é um OBJETO TIPADO. Escrever `titulu` aqui é erro de compilação —
// no SQL na mão do módulo 09, seria uma query que roda e devolve zero linhas.
const antigos = await prisma.livro.findMany({
  where: {
    ano: { lt: 1960 }, // lt, lte, gt, gte, not, in, notIn
    titulo: { contains: 'o' },
    disponivel: true,
  },
  select: { titulo: true, ano: true }, // o TIPO do retorno tem só estes campos
});
console.log('filtro composto:', antigos);

// =====================================================================
titulo('2. include — trazer a relação');
// =====================================================================

const comAutor = await prisma.livro.findMany({
  include: { autor: true }, // faz o JOIN por você
  take: 2,
});
for (const l of comAutor) console.log(`  ${l.titulo} — ${l.autor.nome}`);

// N-N atravessando a tabela de junção: dois níveis de include.
const comGeneros = await prisma.livro.findMany({
  include: { generos: { include: { genero: true } } },
  where: { id: 3 },
});
const generos = comGeneros[0]?.generos.map((lg) => lg.genero.nome);
console.log(`  O Senhor dos Anéis → ${generos?.join(', ')}`);

// `_count` sem trazer as linhas: o COUNT roda no banco, não em JavaScript.
const autoresComContagem = await prisma.autor.findMany({
  include: { _count: { select: { livros: true } } },
});
for (const a of autoresComContagem) console.log(`  ${a.nome}: ${a._count.livros} livros`);

// =====================================================================
titulo('3. O PROBLEMA N+1 — o erro nº 1 de quem usa ORM');
// =====================================================================

console.log('\n>>> ERRADO: 1 query + N queries (conte no log)');
const autores = await prisma.autor.findMany(); // 1 query
for (const autor of autores) {
  // Uma query POR AUTOR. Com 3 autores é imperceptível; com 500, são 501 queries
  // e a rota leva segundos. O código parece limpo — é justamente o perigo.
  const livros = await prisma.livro.findMany({ where: { autorId: autor.id } });
  console.log(`  ${autor.nome}: ${livros.length}`);
}

console.log('\n>>> CERTO: 1 query só, com include');
const autoresComLivros = await prisma.autor.findMany({ include: { livros: true } });
for (const autor of autoresComLivros)
  console.log(`  ${autor.nome}: ${autor.livros.length}`);

// Por baixo o Prisma faz 2 queries (uma por tabela) e junta em memória — não um
// JOIN. Isso é de propósito: evita a explosão de linhas duplicadas de um JOIN
// com N-N. E 2 queries fixas são incomparavelmente melhores que N+1.
//
// COMO DETECTAR NA PRÁTICA:
//   1. `log: ['query']` e conte as linhas de uma requisição
//   2. número de queries crescendo junto com o número de itens = N+1
//   3. em produção: métrica de "queries por requisição" (módulo 14)

// =====================================================================
titulo('4. Escrita: create, nested create, upsert');
// =====================================================================

const ficcao = await prisma.genero.findUniqueOrThrow({ where: { nome: 'ficcao' } });

// Nested create: insere na tabela `livros` E na de junção, numa transação
// implícita. É o BEGIN/COMMIT que escrevemos à mão no módulo 09.
const novo = await prisma.livro.create({
  data: {
    titulo: `Neuromancer ${Date.now() % 1000}`, // sufixo para poder rodar de novo
    ano: 1984,
    autorId: 2,
    generos: { create: [{ generoId: ficcao.id }] },
  },
  include: { generos: { include: { genero: true } } },
});
console.log(
  `criado: ${novo.titulo} (${novo.generos.map((g) => g.genero.nome).join(',')})`,
);

// `undefined` = "não mexe"; `null` = "grave NULL".
//
// ATRITO REAL com o nosso tsconfig: `data: { titulo: undefined }` NÃO compila.
// Os tipos gerados declaram `titulo?: string` (sem `| undefined`), e o
// `exactOptionalPropertyTypes: true` recusa chave presente valendo `undefined` —
// que é justamente o idioma do Prisma.
//
// A saída é omitir a chave, ou montá-la com spread condicional:
//   ...(valor !== undefined ? { titulo: valor } : {})
await prisma.livro.update({
  where: { id: novo.id },
  data: { ano: 1985 }, // titulo simplesmente não aparece
});
console.log('update parcial ok');

// =====================================================================
titulo('5. Transações');
// =====================================================================

// `$transaction([...])` — array de operações independentes, tudo ou nada.
const [totalLivros, totalAutores] = await prisma.$transaction([
  prisma.livro.count(),
  prisma.autor.count(),
]);
console.log(`batch: ${totalLivros} livros, ${totalAutores} autores`);

// `$transaction(async (tx) => ...)` — transação INTERATIVA, quando uma operação
// depende do resultado da anterior. Use `tx`, não `prisma`, dentro dela: usar
// `prisma` sairia da transação e o rollback não desfaria nada.
try {
  await prisma.$transaction(async (tx) => {
    const livro = await tx.livro.findUniqueOrThrow({ where: { id: novo.id } });
    await tx.livro.update({ where: { id: livro.id }, data: { disponivel: false } });
    throw new Error('falha proposital depois do update');
  });
} catch (erro) {
  console.log('transação abortada:', (erro as Error).message);
}

const conferir = await prisma.livro.findUnique({ where: { id: novo.id } });
console.log(`disponivel voltou para ${conferir?.disponivel} — o rollback funcionou`);

// =====================================================================
titulo('6. Quando voltar para SQL cru');
// =====================================================================

// `$queryRaw` com template literal: os `${}` viram parâmetros `?`
// automaticamente, então continua imune a injeção. Nunca use `$queryRawUnsafe`
// com entrada do usuário.
const porDecada = await prisma.$queryRaw<{ decada: number; quantos: bigint }[]>`
  SELECT (ano / 10) * 10 AS decada, COUNT(*) AS quantos
    FROM livros
   GROUP BY decada
   ORDER BY decada
`;
console.log('agregação por década (SQL cru):');
for (const linha of porDecada) console.log(`  ${linha.decada}: ${Number(linha.quantos)}`);

// Quando o SQL cru ganha:
//   - agregação/janela complexa (window functions, CTE recursiva)
//   - a query que o ORM gera está lenta e você já viu o EXPLAIN
//   - recurso específico do banco (full-text search, JSON operators)
// Perde a tipagem — daí o generic explícito, que é uma PROMESSA sua, não uma
// garantia. Se a query mudar e o tipo não, o TypeScript não avisa.

// Limpeza para o exemplo poder rodar de novo.
await prisma.livro.delete({ where: { id: novo.id } });

await prisma.$disconnect();
console.log('\n✓ Fim.');
