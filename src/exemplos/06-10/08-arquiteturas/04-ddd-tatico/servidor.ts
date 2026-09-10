/**
 * COMPOSITION ROOT da versão DDD tático.
 *
 * Rodar:  node src/exemplos/06-10/08-arquiteturas/04-ddd-tatico/servidor.ts
 *
 *   dominio/     entidade Curso, value objects Titulo e CargaHoraria, contrato
 *                do repositório. As REGRAS moram aqui, dentro dos objetos.
 *   aplicacao/   serviço fino: carregar → pedir ao objeto → salvar
 *   infra/       repositório em memória (guarda fotografias, reconstitui)
 *   http/        Express, Zod de formato, mapeamento para JSON
 *
 * A API é a mesma dos outros exemplos. O que muda é ONDE a regra mora.
 */
import express from 'express';
import { rotaNaoEncontrada, tratarErro } from '../../06-erros/tratador.ts';
import { criarServicoCursos } from './aplicacao/servico-cursos.ts';
import { criarRotasCursos, traduzirErroDeDominio } from './http/rotas.ts';
import { criarRepositorioEmMemoria } from './infra/repositorio-memoria.ts';

const repositorio = criarRepositorioEmMemoria([
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
  { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false }, // < 2h: não publica
]);
const servico = criarServicoCursos(repositorio);

const app = express();
app.use(express.json());
app.use('/api/v1/cursos', criarRotasCursos(servico));
app.use(rotaNaoEncontrada);
app.use(traduzirErroDeDominio);
app.use(tratarErro);

const PORT = 5084;
app.listen(PORT, () => {
  console.log(`DDD tático em http://localhost:${PORT}/api/v1/cursos`);
});
