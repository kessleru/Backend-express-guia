/**
 * O CATÁLOGO — implementa a porta de entrada usando as portas de saída.
 *
 * É o equivalente do service do exemplo principal, com duas diferenças que são
 * justamente o que o hexágono acrescenta:
 *
 *   1. ele recebe DUAS portas de saída (repositório e notificador), não uma;
 *   2. ele lança `ErroDoNucleo`, que não sabe o que é status HTTP.
 *
 * Nenhum import de fora de `nucleo/`.
 */
import { ErroDoNucleo } from './curso.ts';
import type { CatalogoDeCursos, Notificador, RepositorioCursos } from './portas.ts';

const HORAS_MINIMAS_PARA_PUBLICAR = 2;

export function criarCatalogo(
  repositorio: RepositorioCursos,
  notificador: Notificador,
): CatalogoDeCursos {
  // Declarar o retorno como `CatalogoDeCursos` é o que amarra esta função à
  // porta de entrada: se um método sumir ou mudar de assinatura, o erro aparece
  // AQUI, e não lá no adaptador que tentar chamá-lo.
  const buscar = async (id: number) => {
    const curso = await repositorio.buscarPorId(id);
    if (!curso) throw new ErroDoNucleo('nao-encontrado', `Curso ${id} não encontrado`);
    return curso;
  };

  return {
    listar: (filtro) => repositorio.listar(filtro),

    buscar,

    async criar(dados) {
      if (await repositorio.buscarPorTitulo(dados.titulo)) {
        throw new ErroDoNucleo(
          'conflito',
          `Já existe um curso chamado "${dados.titulo}"`,
        );
      }
      return repositorio.criar(dados);
    },

    async publicar(id) {
      const curso = await buscar(id);
      if (curso.publicado) throw new ErroDoNucleo('conflito', 'Curso já está publicado');
      if (curso.horas < HORAS_MINIMAS_PARA_PUBLICAR) {
        throw new ErroDoNucleo(
          'regra-violada',
          `Curso precisa de ao menos ${HORAS_MINIMAS_PARA_PUBLICAR}h para ser publicado`,
        );
      }

      const publicado = await repositorio.marcarPublicado(id);
      if (!publicado) {
        throw new ErroDoNucleo('nao-encontrado', `Curso ${id} não encontrado`);
      }

      // O núcleo decide QUANDO avisar (depois de gravar, nunca antes: avisar de
      // uma publicação que falhou é pior que não avisar). COMO avisar é do
      // adaptador que estiver plugado nesta porta.
      await notificador.avisarPublicacao(publicado);
      return publicado;
    },

    async remover(id) {
      const curso = await buscar(id);
      if (curso.publicado) {
        throw new ErroDoNucleo('conflito', 'Curso publicado não pode ser removido');
      }
      await repositorio.remover(id);
    },
  };
}
