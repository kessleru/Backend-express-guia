/**
 * Solução do exercício 06 — biblioteca com tratamento de erro central.
 *
 * Rodar:  node exercicios/06-10/06-erros/solucao/servidor.ts
 * Em produção (para ver a stack desaparecer):
 *         NODE_ENV=production node exercicios/06-10/06-erros/solucao/servidor.ts
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

app.use(identificar); // gera o requestId que o tratador devolve ao cliente
app.use(registrar);
app.use(cors());
app.use(express.json());

app.use('/api', limitar(100, 60_000));
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

// Bug de propósito: prova que o cliente não vê a stack, mas o terminal vê.
app.get('/bug', (_req, res) => {
  const nada = undefined as unknown as { valor: string };
  res.json({ valor: nada.valor }); // TypeError
});

// ---------------------------------------------------------------------
// 404 e tratador — nesta ordem, sempre no fim
// ---------------------------------------------------------------------
app.use(rotaNaoEncontrada);
app.use(tratarErro);

// ---------------------------------------------------------------------
// Rede de segurança do processo
// ---------------------------------------------------------------------
// O tratador do Express só vê erro que passou por uma requisição. Erro em timer,
// callback solto ou worker não passa por ele.
//
// Logar e SAIR é a recomendação oficial do Node: depois de uma exceção não
// capturada o processo está em estado desconhecido e pode corromper dados em
// silêncio. Quem reinicia é o orquestrador (módulo 16).
process.on('unhandledRejection', (motivo) => {
  console.error('UNHANDLED REJECTION — encerrando:', motivo);
  process.exit(1);
});

process.on('uncaughtException', (erro) => {
  console.error('UNCAUGHT EXCEPTION — encerrando:', erro);
  process.exit(1);
});

const PORT = 4060;
app.listen(PORT, () => {
  const modo = process.env.NODE_ENV === 'production' ? 'produção' : 'desenvolvimento';
  console.log(`Biblioteca (${modo}) em http://localhost:${PORT}/api/v1\n`);
});
