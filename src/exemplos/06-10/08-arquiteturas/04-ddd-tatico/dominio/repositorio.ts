/**
 * O REPOSITÓRIO DO AGREGADO — repare no que sumiu em relação ao exemplo
 * principal: não existe `atualizar(id, dadosParciais)`.
 *
 * Em DDD, o agregado é carregado INTEIRO, alterado por um método dele, e salvo
 * INTEIRO. Quem decide o que muda é a entidade, não quem chama o repositório.
 *
 * Um efeito colateral bom: a pegadinha do `{ ...atual, ...dados }` com
 * `undefined` apagando campo (ver o exemplo principal) não tem onde acontecer —
 * não há merge de dados parciais em lugar nenhum.
 */
import type { Curso } from './curso.ts';
import type { Titulo } from './titulo.ts';

export type RepositorioCursos = {
  proximoId(): Promise<number>;
  buscarPorId(id: number): Promise<Curso | null>;
  buscarPorTitulo(titulo: Titulo): Promise<Curso | null>;
  listar(filtro: { publicado?: boolean | undefined }): Promise<Curso[]>;
  salvar(curso: Curso): Promise<void>;
  remover(id: number): Promise<void>;
};
