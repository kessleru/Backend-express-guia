/**
 * A COMPOSIÇÃO — o único arquivo que conhece todas as camadas.
 *
 * Aqui as peças são montadas de dentro para fora:
 *   repositório → service → controller → rota → app
 *
 * Chama-se "composition root". É o lugar onde a decisão concreta ("qual banco?")
 * é tomada, para que nenhuma outra camada precise saber a resposta.
 *
 * Rodar:  node src/exemplos/06-10/08-camadas/servidor.ts
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { rotaNaoEncontrada, tratarErro } from '../06-erros/tratador.ts';
import { criarRepositorioEmMemoria } from './repositorios/cursos-memoria.ts';
import { criarRotasCursos } from './rotas/cursos.ts';
import { criarServicoCursos } from './servicos/cursos.ts';

// 1. A camada de dados. Trocar por SQLite (módulo 09) é trocar ESTA linha.
const repositorio = criarRepositorioEmMemoria([
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
  { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false }, // < 2h: não publica
]);

// 2. As regras, recebendo os dados.
const servico = criarServicoCursos(repositorio);

// 3. As rotas, recebendo as regras.
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

const PORT = 5056;
app.listen(PORT, () => {
  console.log(`API em camadas em http://localhost:${PORT}/api/v1/cursos`);
});

// ---------------------------------------------------------------------
// A DIREÇÃO DAS DEPENDÊNCIAS
// ---------------------------------------------------------------------
//
//   rota → controller → service → RepositorioCursos (interface)
//                                        ▲
//                                        │ implementa
//                              repositorios/cursos-memoria.ts
//
// As flechas apontam sempre para DENTRO. O service depende da interface, não do
// arquivo — então a implementação concreta pode ser trocada por outra sem que
// nenhuma camada interna saiba.
//
// Confira você mesmo: `dominio/curso.ts` não importa nada. `servicos/cursos.ts`
// não importa `express`. Se um dia o service precisar de `req`, alguma
// responsabilidade escorregou de camada.
