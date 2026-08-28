/**
 * Solução do exercício 08 — COMPOSITION ROOT.
 *
 * O único arquivo que conhece todas as camadas. Monta de dentro para fora:
 *   repositório → service → controller → rota → app
 *
 * Rodar:  node exercicios/06-10/08-camadas/solucao/servidor.ts
 * Com log do repositório:
 *         LOG_REPO=1 node exercicios/06-10/08-camadas/solucao/servidor.ts
 */
import express, { Router } from 'express';
import cors from 'cors';
import type { Autor } from './dominio/autor.ts';
import type { Livro } from './dominio/livro.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { exigirChaveEmEscritas } from './middlewares/autenticar.ts';
import { limitar } from './middlewares/limitar.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { criarRepositorioAutores } from './repositorios/autores-memoria.ts';
import { comLog } from './repositorios/livros-com-log.ts';
import { criarRepositorioLivros } from './repositorios/livros-memoria.ts';
import { criarRotasAutores } from './rotas/autores.ts';
import { criarRotasLivros } from './rotas/livros.ts';
import { criarServicoAutores } from './servicos/autores.ts';
import { criarServicoLivros } from './servicos/livros.ts';

// ---------------------------------------------------------------------
// Dados iniciais — o "seed". Vira SQL no módulo 09.
// ---------------------------------------------------------------------

const autoresIniciais: Autor[] = [
  { id: 1, nome: 'J.R.R. Tolkien', nacionalidade: 'britânica' },
  { id: 2, nome: 'Frank Herbert', nacionalidade: 'estadunidense' },
];

const livrosIniciais: Livro[] = [
  {
    id: 1,
    titulo: 'O Hobbit',
    autorId: 1,
    ano: 1937,
    isbn: '9788595084742',
    generos: ['fantasia'],
    disponivel: true,
  },
  { id: 2, titulo: 'Duna', autorId: 2, ano: 1965, generos: ['ficcao'], disponivel: true },
  {
    id: 3,
    titulo: 'O Senhor dos Anéis',
    autorId: 1,
    ano: 1954,
    generos: ['fantasia', 'ficcao'],
    disponivel: false,
  },
];

// ---------------------------------------------------------------------
// 1. REPOSITÓRIOS — a decisão de "qual banco" é tomada AQUI, e só aqui
// ---------------------------------------------------------------------
// Trocar por SQLite (módulo 09) ou Prisma (10) é trocar estas duas linhas.
// Nenhum service, controller ou rota sabe qual implementação está rodando.

const repoAutores = criarRepositorioAutores(autoresIniciais);

// Decorator opcional (desafio extra): envolve o repositório sem alterá-lo.
// Prova prática de que a dependência é da interface, não do arquivo.
const repoLivrosBase = criarRepositorioLivros(livrosIniciais);
const repoLivros = process.env.LOG_REPO ? comLog(repoLivrosBase) : repoLivrosBase;

// ---------------------------------------------------------------------
// 2. SERVICES — recebem repositórios
// ---------------------------------------------------------------------

const servicoLivros = criarServicoLivros(repoLivros, repoAutores);
const servicoAutores = criarServicoAutores(repoAutores, repoLivros);

// ---------------------------------------------------------------------
// 3. ROTAS — recebem services (e montam os controllers por dentro)
// ---------------------------------------------------------------------

const rotasLivros = criarRotasLivros(servicoLivros);
const rotasAutores = criarRotasAutores(servicoAutores, servicoLivros);

// ---------------------------------------------------------------------
// 4. APP
// ---------------------------------------------------------------------

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
v1.use('/livros', rotasLivros);
v1.use('/autores', rotasAutores);
app.use('/api/v1', v1);

app.use(rotaNaoEncontrada);
app.use(tratarErro);

process.on('unhandledRejection', (motivo) => {
  console.error('UNHANDLED REJECTION — encerrando:', motivo);
  process.exit(1);
});
process.on('uncaughtException', (erro) => {
  console.error('UNCAUGHT EXCEPTION — encerrando:', erro);
  process.exit(1);
});

const PORT = 4080;
app.listen(PORT, () => {
  console.log(`Biblioteca em camadas em http://localhost:${PORT}/api/v1\n`);
});
