/**
 * VALUE OBJECT — a carga horária.
 *
 * O ganho sobre `horas: number` não é só validar. É dar à regra um lugar com
 * nome: "basta para publicar?" é uma pergunta que se faz À carga horária, e a
 * resposta mora nela. Nenhum `if (curso.horas < 2)` espalhado pelo código.
 */
import { ErroDeDominio } from './erros.ts';

export class CargaHoraria {
  static readonly MINIMA_PARA_PUBLICAR = 2;
  static readonly MAXIMA = 500;

  readonly horas: number;

  private constructor(horas: number) {
    this.horas = horas;
    Object.freeze(this);
  }

  static de(horas: number): CargaHoraria {
    if (!Number.isInteger(horas) || horas <= 0 || horas > CargaHoraria.MAXIMA) {
      throw new ErroDeDominio(
        'regra-violada',
        `Carga horária precisa ser um inteiro entre 1 e ${CargaHoraria.MAXIMA}`,
      );
    }
    return new CargaHoraria(horas);
  }

  bastaParaPublicar(): boolean {
    return this.horas >= CargaHoraria.MINIMA_PARA_PUBLICAR;
  }
}
