/**
 * VALUE OBJECT — o título de um curso.
 *
 * Por que não deixar `titulo: string` e pronto? Porque aí "título válido" é uma
 * promessa que cada lugar do código precisa lembrar de cumprir. Com o value
 * object, a única porta para existir um `Titulo` é `Titulo.criar`, que valida.
 * Se você tem um `Titulo` na mão, ele É válido — não há como ter um inválido.
 *
 * Três marcas de value object, todas aqui:
 *   1. se valida ao nascer (construtor privado + fábrica);
 *   2. é imutável (`readonly` + `Object.freeze`);
 *   3. compara pelo VALOR (`igual`), não por ser o mesmo objeto na memória.
 */
import { ErroDeDominio } from './erros.ts';

export class Titulo {
  readonly valor: string;

  // `private` bloqueia `new Titulo('x')` fora da classe — só o TypeScript
  // enxerga isso, mas é o suficiente para ninguém pular a validação por engano.
  private constructor(valor: string) {
    this.valor = valor;
    // `readonly` só existe na compilação. O `freeze` garante em runtime: um
    // `(titulo as any).valor = ''` não passa. Imutável é o que deixa dois cursos
    // compartilharem o mesmo objeto sem que um altere o outro.
    Object.freeze(this);
  }

  static criar(bruto: string): Titulo {
    // Normalizar faz parte do valor: "Express  do zero " e "Express do zero" são
    // o mesmo título, e a comparação de unicidade precisa enxergar isso.
    const valor = bruto.trim().replace(/\s+/g, ' ');
    if (valor.length < 3 || valor.length > 120) {
      throw new ErroDeDominio(
        'regra-violada',
        'Título precisa ter entre 3 e 120 caracteres',
      );
    }
    return new Titulo(valor);
  }

  /** Igualdade de valor. `===` entre dois `Titulo` compara endereço, e daria `false`. */
  igual(outro: Titulo): boolean {
    return this.valor.toLowerCase() === outro.valor.toLowerCase();
  }
}
