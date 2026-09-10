/**
 * CÍRCULO 1 — ENTIDADES: as regras que valeriam mesmo sem software.
 *
 * "Curso com menos de 2 horas não pode ser publicado" é regra da escola, não do
 * sistema. Se a escola anotasse os cursos num caderno, a regra continuaria
 * valendo. É isso que põe a regra no círculo mais interno: ela é a última coisa
 * que deveria mudar quando a tecnologia muda.
 *
 * Nenhum import. Nem de `casos-de-uso/`, que é o círculo logo ao lado.
 */

export type Curso = {
  id: number;
  titulo: string;
  horas: number;
  publicado: boolean;
};

export const HORAS_MINIMAS_PARA_PUBLICAR = 2;

/**
 * Por que a regra DEVOLVE a recusa em vez de lançar erro?
 *
 * Porque há dois casos de uso que a consultam, e eles reagem de jeitos
 * diferentes: `publicar-curso` transforma a recusa em erro; `publicar-rascunhos`
 * só pula aquele curso e segue para o próximo. Uma função que lança obrigaria o
 * segundo a embrulhar cada chamada num try/catch.
 */
export type Recusa = { tipo: 'conflito' | 'regra-violada'; motivo: string };

export function motivoParaNaoPublicar(curso: Curso): Recusa | null {
  if (curso.publicado) return { tipo: 'conflito', motivo: 'Curso já está publicado' };
  if (curso.horas < HORAS_MINIMAS_PARA_PUBLICAR) {
    return {
      tipo: 'regra-violada',
      motivo: `Curso precisa de ao menos ${HORAS_MINIMAS_PARA_PUBLICAR}h para ser publicado`,
    };
  }
  return null;
}

export function motivoParaNaoRemover(curso: Curso): Recusa | null {
  if (curso.publicado) {
    return { tipo: 'conflito', motivo: 'Curso publicado não pode ser removido' };
  }
  return null;
}
