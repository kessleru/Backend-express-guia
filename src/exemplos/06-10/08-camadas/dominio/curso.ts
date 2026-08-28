/**
 * O DOMÍNIO: tipos e contratos. Zero dependência de Express, de banco, de nada.
 *
 * Esta é a camada mais interna. A regra da direção das dependências diz que ela
 * não pode importar de nenhuma outra — e é justamente isso que permite as de
 * fora serem trocadas sem mexer aqui.
 */

export type Curso = {
  id: number;
  titulo: string;
  horas: number;
  publicado: boolean;
};

/** O que se pode criar (sem `id`, que é do banco, e sem `publicado`, que é regra). */
export type NovoCurso = { titulo: string; horas: number };

/**
 * Repare no `| undefined` explícito.
 *
 * Com `exactOptionalPropertyTypes: true` (ligado no nosso tsconfig), `titulo?:
 * string` significa "a chave pode não existir" — e recusa uma chave que existe
 * valendo `undefined`. Como o Zod produz `{ titulo?: string | undefined }`,
 * passar o resultado dele para um tipo sem o `| undefined` é erro de compilação.
 *
 * A flag é chata, mas pega um bug real: `{ titulo: undefined }` num `Object.assign`
 * APAGA o título, enquanto `{}` não mexe nele. São coisas diferentes, e sem a
 * flag o TypeScript trata as duas como iguais.
 */
export type AlterarCurso = {
  titulo?: string | undefined;
  horas?: number | undefined;
};

export type FiltroCursos = {
  titulo?: string | undefined;
  publicado?: boolean | undefined;
};

/** O que o repositório aceita gravar. Inclui `publicado`, que o cliente não manda. */
export type AtualizacaoCurso = AlterarCurso & { publicado?: boolean | undefined };

/**
 * O CONTRATO do repositório — uma interface, não uma classe.
 *
 * É a peça central do módulo. O service depende DESTE tipo, não de um arquivo
 * específico. Por isso trocar array em memória (módulo 08) por SQLite (09) por
 * Prisma (10) não muda uma linha do service.
 *
 * Repare no que NÃO tem aqui: nenhum método chamado `findBySQL`, nenhum retorno
 * com formato de linha de banco. A interface fala a linguagem do domínio.
 */
export type RepositorioCursos = {
  listar(filtro: FiltroCursos): Promise<Curso[]>;
  buscarPorId(id: number): Promise<Curso | null>;
  buscarPorTitulo(titulo: string): Promise<Curso | null>;
  criar(dados: NovoCurso): Promise<Curso>;
  atualizar(id: number, dados: AtualizacaoCurso): Promise<Curso | null>;
  remover(id: number): Promise<boolean>;
};

// Por que os métodos são `async` mesmo na versão em memória, que é síncrona?
// Porque a interface tem que servir ao banco de verdade, que É assíncrono. Se
// ela fosse síncrona agora, trocar por SQLite mudaria a assinatura e todo o
// service junto — exatamente o que estamos tentando evitar.
