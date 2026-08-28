/**
 * Configuração do Prisma 7.
 *
 * Novidade da versão 7: a URL do banco saiu do `schema.prisma` e veio para cá.
 * A razão é boa — o schema descreve a FORMA dos dados, conexão é configuração de
 * runtime. Antes, `url = env("DATABASE_URL")` no schema significava que até
 * gerar o client exigia o `.env` presente.
 *
 * Este arquivo é lido pela CLI (`prisma migrate`, `prisma studio`). O client em
 * runtime recebe o adapter direto no construtor — ver `src/exemplos/06-10/10-prisma/db.ts`.
 */
import 'node:process';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    // Onde o SQL gerado é gravado. Vai para o git: é o histórico do banco.
    path: 'prisma/migrations',
    // O seed roda com `prisma migrate reset` e `prisma db seed`.
    seed: 'node prisma/seed.ts',
  },

  // O adapter substitui o `url` do schema. Ele é a ponte entre o Prisma e o
  // driver real — aqui `better-sqlite3`, o mesmo citado no módulo 09 como
  // alternativa madura ao `node:sqlite`.
  //
  // A URL é relativa a este arquivo, não ao schema.
  datasource: {
    url: process.env.DATABASE_URL_PRISMA ?? 'file:./data/prisma-10.sqlite',
  },
});
