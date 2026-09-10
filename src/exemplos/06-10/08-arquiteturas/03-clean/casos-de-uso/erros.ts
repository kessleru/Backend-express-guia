/**
 * O erro dos casos de uso. Como no exemplo hexagonal, ele diz o TIPO do
 * problema e deixa para o adaptador escolher o status HTTP.
 */
import type { Recusa } from '../entidades/curso.ts';

export type TipoDeErro = 'nao-encontrado' | Recusa['tipo'];

export class ErroDeCasoDeUso extends Error {
  readonly tipo: TipoDeErro;

  constructor(tipo: TipoDeErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeCasoDeUso';
    this.tipo = tipo;
  }
}

export const cursoNaoEncontrado = (id: number) =>
  new ErroDeCasoDeUso('nao-encontrado', `Curso ${id} não encontrado`);

export const recusado = (recusa: Recusa) =>
  new ErroDeCasoDeUso(recusa.tipo, recusa.motivo);
