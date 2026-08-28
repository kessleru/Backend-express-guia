/**
 * A instância do Prisma Client — UMA para todo o processo.
 *
 * Este arquivo é praticamente idêntico ao de `exercicios/06-10/10-prisma/solucao/`, e
 * isso é o assunto: o módulo 11 não mudou nada sobre COMO se fala com o banco.
 * Ele acrescentou três tabelas (`usuarios`, `emprestimos`, `refresh_tokens`) ao
 * mesmo schema, e o resto continua valendo.
 *
 * ---------------------------------------------------------------------
 * POR QUE UM SCHEMA SÓ PARA O REPOSITÓRIO INTEIRO
 * ---------------------------------------------------------------------
 * Um projeto Prisma tem um `schema.prisma`, um client gerado e um histórico de
 * migrations. Criar um segundo projeto para os exercícios 11 a 13 significaria
 * duplicar os três e obrigar quem estuda autenticação a configurar Prisma antes
 * de aprender autenticação.
 *
 * O custo aceito é o inverso, e vale saber dele: o banco do exemplo do módulo 10
 * ganhou tabelas que aquele módulo não usa. No `schema.prisma` elas estão
 * separadas por um cabeçalho dizendo de qual módulo são.
 *
 * O nome do arquivo (`prisma-10.sqlite`) ficou do módulo em que ele nasceu.
 * Todas as soluções da biblioteca — 10, 11, 12 e 13 — falam com este mesmo
 * banco, porque são a mesma biblioteca.
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
