/**
 * SERVIÇO DE APLICAÇÃO — fino de propósito.
 *
 * Compare com `08-camadas/servicos/cursos.ts`, o service do exemplo principal:
 * lá, `publicar` tem os `if` da regra. Aqui, `publicar` é carregar → pedir ao
 * curso → salvar. A regra está no curso. É o que Evans descreve como a camada de
 * aplicação: coordena, não decide.
 *
 * A exceção é a unicidade do título, e ela é instrutiva: um curso não consegue
 * saber se OUTRO curso usa o mesmo título. Regra que precisa olhar o conjunto não
 * cabe dentro de um objeto, e sobe para cá.
 */
import { CargaHoraria } from '../dominio/carga-horaria.ts';
import { Curso } from '../dominio/curso.ts';
import { ErroDeDominio } from '../dominio/erros.ts';
import type { RepositorioCursos } from '../dominio/repositorio.ts';
import { Titulo } from '../dominio/titulo.ts';

export function criarServicoCursos(repositorio: RepositorioCursos) {
  const carregar = async (id: number): Promise<Curso> => {
    const curso = await repositorio.buscarPorId(id);
    if (!curso) throw new ErroDeDominio('nao-encontrado', `Curso ${id} não encontrado`);
    return curso;
  };

  return {
    listar: (filtro: { publicado?: boolean | undefined }) => repositorio.listar(filtro),

    buscar: carregar,

    async criar(dados: { titulo: string; horas: number }): Promise<Curso> {
      // A validação de verdade acontece AQUI, ao montar os value objects — não
      // no schema HTTP. Um script de importação que chame `criar` direto passa
      // pela mesma regra que a API.
      const titulo = Titulo.criar(dados.titulo);
      const carga = CargaHoraria.de(dados.horas);

      if (await repositorio.buscarPorTitulo(titulo)) {
        throw new ErroDeDominio(
          'conflito',
          `Já existe um curso chamado "${titulo.valor}"`,
        );
      }

      const curso = Curso.criar(await repositorio.proximoId(), titulo, carga);
      await repositorio.salvar(curso);
      return curso;
    },

    async publicar(id: number): Promise<Curso> {
      const curso = await carregar(id);
      curso.publicar(); // ← a regra inteira está atrás desta chamada
      await repositorio.salvar(curso);
      return curso;
    },

    async remover(id: number): Promise<void> {
      const curso = await carregar(id);
      curso.garantirQuePodeSerRemovido();
      await repositorio.remover(id);
    },
  };
}

export type ServicoCursos = ReturnType<typeof criarServicoCursos>;
