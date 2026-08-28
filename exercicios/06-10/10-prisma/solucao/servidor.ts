/**
 * Solução do exercício 10.
 *
 * A terceira troca de banco. Compare com os servidores dos exercícios 08 e 09:
 * mudam as linhas dos repositórios. Nada mais.
 *
 * Antes de rodar:  npm run db:migrate && npm run db:seed
 * Rodar:           node exercicios/06-10/10-prisma/solucao/servidor.ts
 * Com o SQL:       PRISMA_LOG=1 node exercicios/06-10/10-prisma/solucao/servidor.ts
 */
import express, { Router } from 'express';
import cors from 'cors';
import { fecharPrisma } from './db/prisma.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { exigirChaveEmEscritas } from './middlewares/autenticar.ts';
import { limitar } from './middlewares/limitar.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { criarRepositorioAutoresPrisma } from './repositorios/autores-prisma.ts';
import { criarRepositorioLivrosPrisma } from './repositorios/livros-prisma.ts';
import { criarRotasAutores } from './rotas/autores.ts';
import { criarRotasLivros } from './rotas/livros.ts';
import { criarServicoAutores } from './servicos/autores.ts';
import { criarServicoLivros } from './servicos/livros.ts';

// ---------------------------------------------------------------------
// As DUAS linhas que mudaram
// ---------------------------------------------------------------------
const repoLivros = criarRepositorioLivrosPrisma();
const repoAutores = criarRepositorioAutoresPrisma();

// ---------------------------------------------------------------------
// Idêntico aos exercícios 08 e 09
// ---------------------------------------------------------------------
const servicoLivros = criarServicoLivros(repoLivros, repoAutores);
const servicoAutores = criarServicoAutores(repoAutores, repoLivros);

const app = express();
app.use(identificar);
app.use(registrar);
app.use(cors());
app.use(express.json());
app.use('/api', limitar(200, 60_000));
app.use('/api', exigirChaveEmEscritas);

app.get('/api/v1', (_req, res) => {
  res.json({
    versao: 'v1',
    recursos: { livros: '/api/v1/livros', autores: '/api/v1/autores' },
  });
});

const v1 = Router();
v1.use('/livros', criarRotasLivros(servicoLivros));
v1.use('/autores', criarRotasAutores(servicoAutores, servicoLivros));
app.use('/api/v1', v1);

app.use(rotaNaoEncontrada);
app.use(tratarErro);

const PORT = 4100;
const servidor = app.listen(PORT, () => {
  console.log(`Biblioteca sobre Prisma em http://localhost:${PORT}/api/v1\n`);
});

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    console.log(`\n${sinal}: encerrando...`);
    servidor.close(() => {
      // `$disconnect` devolve as conexões do pool. Sem isso o processo demora a
      // sair, porque o pool mantém o event loop vivo.
      void fecharPrisma().then(() => process.exit(0));
    });
  });
}

process.on('unhandledRejection', (motivo) => {
  console.error('UNHANDLED REJECTION — encerrando:', motivo);
  process.exit(1);
});
process.on('uncaughtException', (erro) => {
  console.error('UNCAUGHT EXCEPTION — encerrando:', erro);
  process.exit(1);
});
