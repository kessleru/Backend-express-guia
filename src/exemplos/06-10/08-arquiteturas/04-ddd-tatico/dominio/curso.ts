/**
 * ENTIDADE e RAIZ DO AGREGADO — o curso, com as regras DENTRO dele.
 *
 * Esta é a diferença central para o exemplo principal do módulo. Lá, `Curso` é
 * um tipo só com dados, e quem decide se ele pode ser publicado é o service:
 *
 *   if (curso.horas < 2) throw ...;         // no service
 *   repositorio.atualizar(id, { publicado: true });
 *
 * Nada impede outro arquivo de chamar `atualizar(id, { publicado: true })` direto
 * e pular a regra. Aqui não dá: `#publicado` é privado de verdade (é JavaScript,
 * não só TypeScript), e o único jeito de mudá-lo é `curso.publicar()` — que
 * confere a regra antes.
 *
 * ENTIDADE porque tem identidade: dois cursos com o mesmo título e as mesmas
 * horas continuam sendo dois cursos (ids diferentes). Compare com `Titulo`,
 * que é value object: dois títulos iguais SÃO o mesmo título.
 */
import { CargaHoraria } from './carga-horaria.ts';
import { ErroDeDominio } from './erros.ts';
import { Titulo } from './titulo.ts';

/** O formato "achatado" que o banco guarda e o repositório devolve. */
export type FotografiaCurso = {
  id: number;
  titulo: string;
  horas: number;
  publicado: boolean;
};

export class Curso {
  readonly id: number;
  #titulo: Titulo;
  #cargaHoraria: CargaHoraria;
  #publicado: boolean;

  private constructor(
    id: number,
    titulo: Titulo,
    carga: CargaHoraria,
    publicado: boolean,
  ) {
    this.id = id;
    this.#titulo = titulo;
    this.#cargaHoraria = carga;
    this.#publicado = publicado;
  }

  /** Nascer: todo curso começa como rascunho. O cliente não escolhe isso. */
  static criar(id: number, titulo: Titulo, carga: CargaHoraria): Curso {
    return new Curso(id, titulo, carga, false);
  }

  /**
   * Voltar do banco. Não é "criar": o curso já existia, e pode estar publicado.
   * Os value objects revalidam o que vem do banco — um registro corrompido
   * falha aqui, na entrada, em vez de três chamadas adiante.
   */
  static reconstituir(foto: FotografiaCurso): Curso {
    return new Curso(
      foto.id,
      Titulo.criar(foto.titulo),
      CargaHoraria.de(foto.horas),
      foto.publicado,
    );
  }

  get titulo(): Titulo {
    return this.#titulo;
  }
  get cargaHoraria(): CargaHoraria {
    return this.#cargaHoraria;
  }
  get publicado(): boolean {
    return this.#publicado;
  }

  // --- COMPORTAMENTO: a regra mora aqui, perto do dado que ela protege ----

  publicar(): void {
    if (this.#publicado) throw new ErroDeDominio('conflito', 'Curso já está publicado');
    if (!this.#cargaHoraria.bastaParaPublicar()) {
      throw new ErroDeDominio(
        'regra-violada',
        `Curso precisa de ao menos ${CargaHoraria.MINIMA_PARA_PUBLICAR}h para ser publicado`,
      );
    }
    this.#publicado = true;
  }

  garantirQuePodeSerRemovido(): void {
    if (this.#publicado) {
      throw new ErroDeDominio('conflito', 'Curso publicado não pode ser removido');
    }
  }

  /** O caminho de volta para o banco. Só dados, sem comportamento. */
  fotografar(): FotografiaCurso {
    return {
      id: this.id,
      titulo: this.#titulo.valor,
      horas: this.#cargaHoraria.horas,
      publicado: this.#publicado,
    };
  }
}
