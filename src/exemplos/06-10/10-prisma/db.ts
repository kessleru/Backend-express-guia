/**
 * A instância do Prisma Client.
 *
 * No Prisma 7 o client recebe um **adapter** no construtor — a ponte entre o
 * Prisma e o driver real. Antes a conexão vinha do `url` no schema; agora é
 * explícita, e o mesmo client serve a drivers diferentes (better-sqlite3, libsql,
 * pg, planetscale) sem mudar uma linha das queries.
 */
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './gerado/client.ts';

// O caminho é relativo ao processo (a raiz do repo), não a este arquivo.
const url = process.env.DATABASE_URL_PRISMA ?? 'file:./data/prisma-10.sqlite';

const adapter = new PrismaBetterSqlite3({ url });

export const prisma = new PrismaClient({
  adapter,

  // `log: ['query']` imprime o SQL que o Prisma gerou. LIGUE ISSO enquanto
  // estuda: é a única forma de ver quantas queries um `include` está disparando,
  // e é assim que se descobre um N+1 antes da produção descobrir por você.
  log: process.env.PRISMA_LOG ? ['query'] : [],
});

/**
 * Uma instância só para todo o processo.
 *
 * Criar um `new PrismaClient()` por requisição esgota o pool de conexões em
 * minutos. O client é feito para ser um singleton — o pool interno é dele.
 */
export async function fecharPrisma(): Promise<void> {
  await prisma.$disconnect();
}
