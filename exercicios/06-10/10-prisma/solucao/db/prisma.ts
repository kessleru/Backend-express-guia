/**
 * A instância do Prisma Client — UMA para todo o processo.
 *
 * Sobre o caminho do import: o client é gerado em
 * `src/exemplos/06-10/10-prisma/gerado/`, porque um projeto Prisma tem um schema e um
 * output. Os modelos `Autor`, `Livro`, `Genero` e `LivroGenero` do
 * `prisma/schema.prisma` SÃO os da biblioteca — então esta solução usa o mesmo
 * client, em vez de duplicar schema e migrations.
 *
 * Num projeto seu, o client ficaria em `src/gerado/` e o import seria curto.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../../../../../src/exemplos/06-10/10-prisma/gerado/client.ts';

const url = process.env.DATABASE_URL_PRISMA ?? 'file:./data/prisma-10.sqlite';

/**
 * `new PrismaClient()` por requisição esgota o pool de conexões em minutos. O
 * client é feito para ser singleton — o pool interno é dele, e ele reaproveita
 * conexão entre requisições.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),

  // LIGUE isto enquanto estuda: `PRISMA_LOG=1 node servidor.ts`.
  // É a única forma de ver quantas queries um `include` dispara — e de detectar
  // um N+1 antes da produção detectar por você.
  log: process.env.PRISMA_LOG ? ['query'] : [],
});

export const fecharPrisma = () => prisma.$disconnect();
