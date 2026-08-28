/**
 * Solução do exercício 04 — biblioteca em routers.
 *
 * Este arquivo não sabe o que é um livro nem um autor. Ele só monta.
 *
 * Rodar:  node exercicios/01-05/04-roteamento/solucao/servidor.ts
 */
import express, { Router } from 'express';
import { rotasAutores } from './rotas/autores.ts';
import { rotasLivros } from './rotas/livros.ts';

const app = express();
app.use(express.json());

// Índice: quem abre a API sem documentação encontra o caminho.
// Vem antes da montagem da v1 porque `GET /api/v1` (caminho exato) não casa com
// nenhuma rota de dentro dos routers — mas a ordem aqui deixa a intenção clara.
app.get('/api/v1', (_req, res) => {
  res.json({
    versao: 'v1',
    recursos: {
      livros: '/api/v1/livros',
      autores: '/api/v1/autores',
    },
  });
});

// ---------------------------------------------------------------------
// Desafio extra: aviso de versão em vias de aposentadoria
// ---------------------------------------------------------------------
// PRECISA vir antes do `app.use('/api/v1', v1)`. Depois da montagem, as rotas da
// v1 já teriam respondido e este middleware nunca rodaria — o erro de ordem mais
// comum com middleware, e o mais silencioso: nada quebra, o header só não aparece.
//
// E é `next()` que passa a bola adiante. Esse é o módulo 05.
app.use('/api/v1', (_req, res, next) => {
  res.set('X-Api-Deprecated', 'v1; use /api/v2');
  next();
});

// Cada versão é um Router só para agrupar. Assim o prefixo aparece uma vez, e os
// routers de recurso não sabem em que versão estão montados.
const v1 = Router();
v1.use('/livros', rotasLivros);
v1.use('/autores', rotasAutores);
app.use('/api/v1', v1);

const v2 = Router();
v2.use('/livros', rotasLivros); // mesmo router, outro prefixo: zero duplicação
v2.use('/autores', rotasAutores);
app.use('/api/v2', v2);

// ---------------------------------------------------------------------
// 404 genérico — SEMPRE por último
// ---------------------------------------------------------------------
// `app.use` sem caminho casa com qualquer requisição que chegou até aqui.
// No topo do arquivo, ele transformaria tudo em 404.

app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
});

const PORT = 4040;
app.listen(PORT, () => {
  console.log(`Biblioteca em http://localhost:${PORT}/api/v1`);
});
