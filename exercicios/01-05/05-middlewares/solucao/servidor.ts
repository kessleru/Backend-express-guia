/**
 * Solução do exercício 05 — a biblioteca com a pilha de middlewares montada.
 *
 * A ordem deste arquivo É a solução. Leia de cima para baixo: é exatamente a
 * ordem em que cada requisição atravessa o servidor.
 *
 * Rodar:  node exercicios/01-05/05-middlewares/solucao/servidor.ts
 */
import express, { Router } from 'express';
import cors from 'cors';
import { exigirChaveEmEscritas, exigirPapel } from './middlewares/autenticar.ts';
import { limitar } from './middlewares/limitar.ts';
import {
  apenasEmDesenvolvimento,
  atrasar,
  identificar,
  registrar,
} from './middlewares/log.ts';
import { rotasAutores } from './rotas/autores.ts';
import { rotasLivros } from './rotas/livros.ts';

const app = express();

// ---------------------------------------------------------------------
// 1. OBSERVABILIDADE — primeiro, para registrar até o que dá erro
// ---------------------------------------------------------------------
// `identificar` antes de `registrar`: o log precisa do requestId que o primeiro
// gera. Trocar a ordem faz o log sair com id vazio — e nada avisa.
app.use(identificar);
app.use(registrar);

// ---------------------------------------------------------------------
// 2. HEADERS E PARSING
// ---------------------------------------------------------------------
app.use(cors());

// EXPERIMENTO do enunciado: mova esta linha para DEPOIS do `app.use('/api/v1')`
// lá embaixo e rode um POST. Ele passa a falhar porque `req.body` é `undefined`
// quando a rota executa — o parser está na fila, mas atrás de quem já respondeu.
// Nenhum warning aparece. É o bug de ordem mais comum do Express.
app.use(express.json());

// Latência artificial só em desenvolvimento — descobre front sem loading.
// Descomente para sentir:
// app.use(apenasEmDesenvolvimento(atrasar(300)));
void apenasEmDesenvolvimento; // (mantido importado para o exemplo acima)
void atrasar;

// ---------------------------------------------------------------------
// 3. PROTEÇÕES — só no que é /api
// ---------------------------------------------------------------------
// Rate limit antes da autenticação: assim uma rajada de chaves inválidas é
// barata de recusar. O contrário faria você validar 10.000 chaves antes de
// perceber que é abuso.
app.use('/api', limitar(20, 60_000));

// Leitura é pública; escrita exige chave. A checagem por método fica num lugar
// só — nenhuma rota nova sai desprotegida por esquecimento.
app.use('/api', exigirChaveEmEscritas);

// ---------------------------------------------------------------------
// 4. ROTAS
// ---------------------------------------------------------------------
app.get('/api/v1', (_req, res) => {
  res.json({
    versao: 'v1',
    recursos: { livros: '/api/v1/livros', autores: '/api/v1/autores' },
  });
});

const v1 = Router();
v1.use('/livros', rotasLivros);

// Middleware por rota, colado onde importa: `exigirPapel` protege só o DELETE de
// autor. Pendurar na rota deixa a proteção visível para quem lê o código.
// O `()` é obrigatório — é uma fábrica.
v1.delete('/autores/:id', exigirPapel('admin'));
v1.use('/autores', rotasAutores);

app.use('/api/v1', v1);

// ---------------------------------------------------------------------
// 5. 404 — por último
// ---------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
});

const PORT = 4050;
app.listen(PORT, () => {
  console.log(`Biblioteca com middlewares em http://localhost:${PORT}/api/v1\n`);
});
