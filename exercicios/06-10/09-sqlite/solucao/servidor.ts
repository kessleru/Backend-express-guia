/**
 * Solução do exercício 09.
 *
 * COMPARE com `exercicios/06-10/08-camadas/solucao/servidor.ts`. A diferença são as
 * linhas que constroem os repositórios (e o fechamento do banco no fim).
 * `servicos/`, `controllers/`, `rotas/`, `dominio/` e `schemas/`: idênticos.
 *
 * Rodar:  node exercicios/06-10/09-sqlite/solucao/servidor.ts
 * Banco em `data/biblioteca-09.sqlite` (ignorado pelo git).
 */
import express, { Router } from 'express';
import cors from 'cors';
import { abrirBanco } from './db/conexao.ts';
import { rodarSeed } from './db/seed.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { exigirChaveEmEscritas } from './middlewares/autenticar.ts';
import { limitar } from './middlewares/limitar.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { criarRepositorioAutoresSqlite } from './repositorios/autores-sqlite.ts';
import { criarRepositorioLivrosSqlite } from './repositorios/livros-sqlite.ts';
import { criarRotasAutores } from './rotas/autores.ts';
import { criarRotasLivros } from './rotas/livros.ts';
import { criarServicoAutores } from './servicos/autores.ts';
import { criarServicoLivros } from './servicos/livros.ts';

// ---------------------------------------------------------------------
// A ÚNICA parte diferente do exercício 08
// ---------------------------------------------------------------------

console.log('Abrindo banco...');
const db = abrirBanco('data/biblioteca-09.sqlite');
rodarSeed(db);

const repoLivros = criarRepositorioLivrosSqlite(db);
const repoAutores = criarRepositorioAutoresSqlite(db);

// ---------------------------------------------------------------------
// Daqui para baixo: idêntico ao exercício 08
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

const PORT = 4090;
const servidor = app.listen(PORT, () => {
  console.log(`Biblioteca sobre SQLite em http://localhost:${PORT}/api/v1\n`);
});

// Fechar o banco no encerramento consolida os arquivos -wal/-shm do WAL.
// Graceful shutdown de verdade — esperar requisições em andamento — no módulo 15.
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    console.log(`\n${sinal}: encerrando...`);
    servidor.close(() => {
      db.close();
      process.exit(0);
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
