/**
 * AS PORTAS — os contratos nas bordas do hexágono.
 *
 * Porta é um tipo que diz "por aqui o núcleo conversa com o mundo". Existem dois
 * sentidos de conversa, e é a distinção mais útil do padrão:
 *
 *   ENTRADA (quem manda no núcleo)   → o mundo chama o núcleo
 *   SAÍDA   (quem obedece ao núcleo) → o núcleo chama o mundo
 *
 * As DUAS moram aqui dentro, e isso é o que parece estranho à primeira vista: a
 * porta de saída descreve algo que fica lá fora (um banco, um e-mail), mas quem
 * escreve o contrato é o núcleo, na língua dele. O lado de fora se adapta.
 */
import type { Curso, FiltroCursos, NovoCurso } from './curso.ts';

// --- PORTA DE ENTRADA ------------------------------------------------------
// O que o mundo pode pedir ao catálogo. O adaptador HTTP e o adaptador de linha
// de comando chamam ESTES métodos — e nenhum outro. É a lista de "casos de uso"
// do sistema, escrita como tipo.
export type CatalogoDeCursos = {
  listar(filtro: FiltroCursos): Promise<Curso[]>;
  buscar(id: number): Promise<Curso>;
  criar(dados: NovoCurso): Promise<Curso>;
  publicar(id: number): Promise<Curso>;
  remover(id: number): Promise<void>;
};

// --- PORTAS DE SAÍDA -------------------------------------------------------
// O que o núcleo precisa que alguém faça por ele.

/** Guardar e buscar. Mesmo contrato do `RepositorioCursos` do exemplo principal. */
export type RepositorioCursos = {
  listar(filtro: FiltroCursos): Promise<Curso[]>;
  buscarPorId(id: number): Promise<Curso | null>;
  buscarPorTitulo(titulo: string): Promise<Curso | null>;
  criar(dados: NovoCurso): Promise<Curso>;
  marcarPublicado(id: number): Promise<Curso | null>;
  remover(id: number): Promise<boolean>;
};

/**
 * Avisar alguém de que um curso saiu. Uma segunda porta de saída, para mostrar
 * que o hexágono não é "o jeito de trocar de banco": banco é só um dos lados de
 * fora. E-mail, fila, relógio, API de pagamento — cada um vira uma porta.
 *
 * Repare no nome: `avisarPublicacao`, não `enviarEmail`. O núcleo diz O QUE
 * quer; se é e-mail, push ou uma linha no console, é problema do adaptador.
 */
export type Notificador = {
  avisarPublicacao(curso: Curso): Promise<void>;
};
