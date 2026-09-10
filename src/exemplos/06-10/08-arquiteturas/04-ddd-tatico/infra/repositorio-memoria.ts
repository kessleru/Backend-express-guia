/**
 * INFRAESTRUTURA — o repositório guarda FOTOGRAFIAS, não objetos `Curso`.
 *
 * Seria mais curto guardar a própria instância num array. E seria um bug: quem
 * buscasse o curso receberia a MESMA instância que está "no banco", e um
 * `curso.publicar()` sem `salvar` mudaria o banco sozinho. Guardar a fotografia
 * e reconstituir a cada busca é o que um banco de verdade faz de graça — cada
 * leitura devolve um objeto novo.
 *
 * O custo à mostra: `fotografar()` na ida e `Curso.reconstituir()` na volta. Com
 * Prisma (módulo 10) o mapeamento é o mesmo, só que entre a linha do banco e a
 * entidade. É o "mapper" que a tabela do módulo chama de "raramente compensa" em
 * CRUD simples — aqui ele existe porque a entidade tem campos privados.
 */
import { Curso } from '../dominio/curso.ts';
import type { FotografiaCurso } from '../dominio/curso.ts';
import type { RepositorioCursos } from '../dominio/repositorio.ts';

export function criarRepositorioEmMemoria(
  iniciais: FotografiaCurso[],
): RepositorioCursos {
  const fotos = new Map(iniciais.map((f) => [f.id, { ...f }]));

  return {
    async proximoId() {
      return Math.max(0, ...fotos.keys()) + 1;
    },
    async buscarPorId(id) {
      const foto = fotos.get(id);
      return foto ? Curso.reconstituir(foto) : null;
    },
    async buscarPorTitulo(titulo) {
      for (const foto of fotos.values()) {
        const curso = Curso.reconstituir(foto);
        if (curso.titulo.igual(titulo)) return curso;
      }
      return null;
    },
    async listar(filtro) {
      return [...fotos.values()]
        .filter((f) => filtro.publicado === undefined || f.publicado === filtro.publicado)
        .map((f) => Curso.reconstituir(f));
    },
    async salvar(curso) {
      fotos.set(curso.id, curso.fotografar());
    },
    async remover(id) {
      fotos.delete(id);
    },
  };
}
