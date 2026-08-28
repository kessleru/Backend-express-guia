/**
 * Solução do exercício 07 — biblioteca com validação Zod.
 *
 * Rodar:  node exercicios/06-10/07-validacao/solucao/servidor.ts
 */
import express, { Router } from 'express';
import cors from 'cors';
import { exigirChaveEmEscritas, exigirPapel } from './middlewares/autenticar.ts';
import { limitar } from './middlewares/limitar.ts';
import { identificar, registrar } from './middlewares/log.ts';
import { rotaNaoEncontrada, tratarErro } from './erros/tratador.ts';
import { rotasAutores } from './rotas/autores.ts';
import { rotasLivros } from './rotas/livros.ts';

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
v1.delete('/autores/:id', exigirPapel('admin'));
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

const PORT = 4070;
app.listen(PORT, () => {
  console.log(`Biblioteca com Zod em http://localhost:${PORT}/api/v1\n`);
});
