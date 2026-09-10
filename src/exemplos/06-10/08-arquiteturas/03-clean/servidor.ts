/**
 * COMPOSITION ROOT da versão Clean Architecture.
 *
 * Rodar:  node src/exemplos/06-10/08-arquiteturas/03-clean/servidor.ts
 *
 * Os quatro círculos, de dentro para fora, com as pastas deste exemplo:
 *
 *   1. entidades/      regra que valeria sem software ("< 2h não publica")
 *   2. casos-de-uso/   um arquivo por operação + o contrato do repositório
 *   3. adaptadores/    controller, apresentador, schemas, repositório em memória
 *   4. frameworks/     o Express
 *
 * A montagem é de dentro para fora, igual ao exemplo principal do módulo — só
 * que com seis casos de uso no lugar de um service.
 */
import { criarRepositorioEmMemoria } from './adaptadores/repositorio-memoria.ts';
import { criarControllerCursos } from './adaptadores/controller.ts';
import { buscarCurso } from './casos-de-uso/buscar-curso.ts';
import { criarCurso } from './casos-de-uso/criar-curso.ts';
import { listarCursos } from './casos-de-uso/listar-cursos.ts';
import { publicarCurso } from './casos-de-uso/publicar-curso.ts';
import { publicarRascunhos } from './casos-de-uso/publicar-rascunhos.ts';
import { removerCurso } from './casos-de-uso/remover-curso.ts';
import { criarApp } from './frameworks/web.ts';

const repositorio = criarRepositorioEmMemoria([
  { id: 1, titulo: 'Fundamentos de HTTP', horas: 4, publicado: true },
  { id: 2, titulo: 'Express do zero', horas: 8, publicado: false },
  { id: 3, titulo: 'Curso relâmpago', horas: 1, publicado: false }, // < 2h: não publica
]);

// Seis linhas onde o exemplo principal tem uma (`criarServicoCursos(repo)`). É
// o custo visível de "um arquivo por caso de uso": cada operação nova é um
// arquivo novo E uma linha nova aqui.
const controller = criarControllerCursos({
  listar: listarCursos(repositorio),
  buscar: buscarCurso(repositorio),
  criar: criarCurso(repositorio),
  publicar: publicarCurso(repositorio),
  publicarRascunhos: publicarRascunhos(repositorio),
  remover: removerCurso(repositorio),
});

const PORT = 5083;
criarApp(controller).listen(PORT, () => {
  console.log(`Clean em http://localhost:${PORT}/api/v1/cursos`);
});
