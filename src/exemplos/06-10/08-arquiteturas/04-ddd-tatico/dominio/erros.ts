/** O erro do domínio: diz o tipo do problema, nunca o status HTTP. */
export type TipoDeErro = 'nao-encontrado' | 'conflito' | 'regra-violada';

export class ErroDeDominio extends Error {
  readonly tipo: TipoDeErro;

  constructor(tipo: TipoDeErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeDominio';
    this.tipo = tipo;
  }
}
