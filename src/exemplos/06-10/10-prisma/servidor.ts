/**
 * O MESMO servidor, agora sobre Prisma. Terceira implementação da mesma interface.
 *
 * Coloque os três lado a lado:
 *   src/exemplos/06-10/08-camadas/servidor.ts   → array em memória
 *   src/exemplos/06-10/09-sqlite/servidor.ts    → node:sqlite
 *   src/exemplos/06-10/10-prisma/servidor.ts    → Prisma
 *
 * Muda a construção do repositório. Service, controller, rotas e schemas são
 * importados dos módulos anteriores, sem cópia e sem alteração.
 *
 * Rodar:  node src/exemplos/06-10/10-prisma/servidor.ts
 * Com SQL no terminal:  PRISMA_LOG=1 node src/exemplos/06-10/10-prisma/servidor.ts
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { rotaNaoEncontrada, tratarErro } from '../06-erros/tratador.ts';
import { criarRotasCursos } from '../08-camadas/rotas/cursos.ts';
import { criarServicoCursos } from '../08-camadas/servicos/cursos.ts';
import { fecharPrisma } from './db.ts';
import { criarRepositorioPrisma, seedCursos } from './repositorio-prisma.ts';

// A única linha diferente.
const repositorio = criarRepositorioPrisma();

await seedCursos(); // top-level await: só existe em ESM (módulo 02)

const servico = criarServicoCursos(repositorio);
const rotasCursos = criarRotasCursos(servico);

const app = express();
app.use(express.json());
app.use((_req, res, next) => {
  res.locals.requestId = randomUUID().slice(0, 8);
  next();
});

app.use('/api/v1/cursos', rotasCursos);
app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = 5058;
const servidor = app.listen(PORT, () => {
  console.log(`API sobre Prisma em http://localhost:${PORT}/api/v1/cursos`);
  console.log('(os dados vêm do seed: npx prisma db seed)');
});

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    console.log(`\n${sinal}: encerrando...`);
    servidor.close(() => {
      // `$disconnect` devolve as conexões do pool. Sem isso o processo pode
      // demorar a sair — o pool mantém o event loop vivo.
      void fecharPrisma().then(() => process.exit(0));
    });
  });
}
