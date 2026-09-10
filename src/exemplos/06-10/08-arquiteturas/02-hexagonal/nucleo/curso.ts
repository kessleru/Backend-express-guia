/**
 * O NÚCLEO — o que o sistema É, sem dizer por onde ele é usado.
 *
 * Nesta pasta nada importa Express, Zod, `node:readline` ou banco. É a regra de
 * ouro do hexágono: o lado de dentro não conhece o lado de fora. Quem conhece os
 * dois são os adaptadores (`../adaptadores/`).
 */

export type Curso = {
  id: number;
  titulo: string;
  horas: number;
  publicado: boolean;
};

export type NovoCurso = { titulo: string; horas: number };

export type FiltroCursos = { publicado?: boolean | undefined };

/**
 * O erro do núcleo NÃO carrega status HTTP.
 *
 * Compare com o exemplo principal do módulo (`08-camadas/servicos/cursos.ts`), em
 * que o service lança `conflito(...)` — um `AppError` com `status: 409` dentro.
 * Lá, o service sabe que existe HTTP, ainda que só por um número.
 *
 * Aqui o núcleo diz apenas QUE TIPO de problema aconteceu. Cada adaptador de
 * entrada traduz para a própria língua: o HTTP vira 404/409/400, a linha de
 * comando vira código de saída. É o preço de ter dois adaptadores de entrada — e
 * é o que permite ter dois.
 */
export type TipoDeErro = 'nao-encontrado' | 'conflito' | 'regra-violada';

export class ErroDoNucleo extends Error {
  readonly tipo: TipoDeErro;

  constructor(tipo: TipoDeErro, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDoNucleo';
    this.tipo = tipo;
  }
}
