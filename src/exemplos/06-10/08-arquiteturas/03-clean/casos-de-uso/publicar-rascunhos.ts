/**
 * CASO DE USO — publicar todos os rascunhos de uma vez.
 *
 * É o MESMO pedido que, em `01-tudo-na-rota/servidor.ts`, virou uma cópia da
 * regra que esqueceu a condição das 2 horas. Aqui não há o que copiar: a regra
 * tem um endereço (`motivoParaNaoPublicar`) e este arquivo só a chama.
 *
 * Resultado na prática: o "Curso relâmpago" (1h) aparece em `recusados`, com o
 * motivo, em vez de ser publicado em silêncio.
 */
import { motivoParaNaoPublicar } from '../entidades/curso.ts';
import type { Curso } from '../entidades/curso.ts';
import type { RepositorioCursos } from './portas.ts';

export type ResultadoEmLote = {
  publicados: Curso[];
  recusados: { id: number; motivo: string }[];
};

export type PublicarRascunhos = () => Promise<ResultadoEmLote>;

export function publicarRascunhos(repositorio: RepositorioCursos): PublicarRascunhos {
  return async () => {
    const resultado: ResultadoEmLote = { publicados: [], recusados: [] };

    for (const curso of await repositorio.listar({ publicado: false })) {
      const recusa = motivoParaNaoPublicar(curso);
      if (recusa) {
        resultado.recusados.push({ id: curso.id, motivo: recusa.motivo });
        continue;
      }
      const publicado = { ...curso, publicado: true };
      await repositorio.salvar(publicado);
      resultado.publicados.push(publicado);
    }

    return resultado;
  };
}
