/**
 * Seed do Prisma.
 *
 * Rodar:  npx prisma db seed
 * Roda também automaticamente no `npx prisma migrate reset`.
 *
 * `upsert` em vez de `create`: o seed fica idempotente e pode rodar quantas
 * vezes for. É a mesma ideia do `INSERT OR IGNORE` do módulo 09.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/exemplos/06-10/10-prisma/gerado/client.ts';

const url = process.env.DATABASE_URL_PRISMA ?? 'file:./data/prisma-10.sqlite';
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main() {
  // ---- Gêneros ----
  // `createMany({ skipDuplicates: true })` seria o natural aqui — e o Prisma
  // RECUSA no SQLite: `skipDuplicates` só existe onde o banco tem
  // `INSERT ... ON CONFLICT DO NOTHING` da forma que o Prisma espera.
  //
  // É um exemplo do que o ORM cobra em troca da abstração: a API não é a mesma
  // em todos os bancos, e a diferença só aparece em runtime. `upsert` num laço
  // funciona em todos.
  for (const nome of ['ficcao', 'fantasia', 'tecnico', 'biografia']) {
    await prisma.genero.upsert({ where: { nome }, update: {}, create: { nome } });
  }

  // ---- Autores ----
  const tolkien = await prisma.autor.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nome: 'J.R.R. Tolkien',
      nacionalidade: 'britânica',
      nascimento: new Date('1892-01-03'),
    },
  });

  const herbert = await prisma.autor.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      nome: 'Frank Herbert',
      nacionalidade: 'estadunidense',
      nascimento: new Date('1920-10-08'),
    },
  });

  // ---- Livros com gêneros, em UMA chamada ----
  // Este `create` aninhado insere na tabela `livros` E na de junção. O Prisma
  // envolve tudo numa transação sozinho — é o que fizemos com BEGIN/COMMIT à mão
  // no módulo 09.
  const fantasia = await prisma.genero.findUniqueOrThrow({ where: { nome: 'fantasia' } });
  const ficcao = await prisma.genero.findUniqueOrThrow({ where: { nome: 'ficcao' } });

  await prisma.livro.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      titulo: 'O Hobbit',
      ano: 1937,
      isbn: '9788595084742',
      autorId: tolkien.id,
      generos: { create: [{ generoId: fantasia.id }] },
    },
  });

  await prisma.livro.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      titulo: 'Duna',
      ano: 1965,
      autorId: herbert.id,
      generos: { create: [{ generoId: ficcao.id }] },
    },
  });

  await prisma.livro.upsert({
    where: { id: 3 },
    update: {},
    create: {
      id: 3,
      titulo: 'O Senhor dos Anéis',
      ano: 1954,
      isbn: '9788595084759',
      disponivel: false,
      autorId: tolkien.id,
      generos: { create: [{ generoId: fantasia.id }, { generoId: ficcao.id }] },
    },
  });

  const [autores, livros] = await Promise.all([
    prisma.autor.count(),
    prisma.livro.count(),
  ]);
  console.log(`Seed: ${autores} autores, ${livros} livros`);
}

// `finally` com `$disconnect`: sem isso o processo fica pendurado, porque o pool
// de conexões mantém o event loop vivo.
try {
  await main();
} finally {
  await prisma.$disconnect();
}
