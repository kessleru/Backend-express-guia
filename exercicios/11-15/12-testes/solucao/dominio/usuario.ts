/**
 * Domínio de usuário. Como todo arquivo de `dominio/`, não importa nada —
 * nem Express, nem Zod, nem jsonwebtoken, nem argon2.
 *
 * Isso não é purismo: é o que permite testar a regra "só o dono devolve" sem
 * subir servidor (módulo 12) e trocar Argon2 por outro algoritmo sem tocar em
 * regra de negócio nenhuma.
 */

/**
 * PAPÉIS.
 *
 * Um conjunto fechado, declarado num lugar só. Papel como `string` livre é
 * como se erra: um dia alguém grava `"Admin"` com maiúscula e a comparação
 * `papel === 'admin'` passa a devolver `false` em silêncio — ninguém é
 * bloqueado por erro, todo mundo é bloqueado por engano.
 *
 * `as const` + índice em vez de `enum` porque `erasableSyntaxOnly` proíbe
 * `enum` neste repo (o Node só apaga tipos, não transforma código).
 */
export const PAPEIS = ['leitor', 'admin'] as const;
export type Papel = (typeof PAPEIS)[number];

/**
 * O usuário como ele vive no banco. `senhaHash`, nunca `senha`.
 *
 * O nome do campo é uma escolha de design defensivo: um campo chamado `senha`
 * convida alguém a gravar a senha crua nele. `senhaHash` denuncia o erro na
 * hora da leitura do código.
 */
export type Usuario = {
  id: number;
  email: string;
  senhaHash: string;
  papel: Papel;
  criadoEm: Date;
};

/**
 * O que sai da API.
 *
 * `Pick` em vez de um tipo escrito à mão de propósito: se amanhã `Usuario`
 * ganhar `cpf` ou `tokenDeRecuperacao`, este tipo NÃO ganha — o campo novo fica
 * de fora por omissão, que é o padrão seguro.
 *
 * E o ganho principal: `res.json(usuario)` passa a não compilar onde o handler
 * declara devolver `UsuarioPublico`. O vazamento vira erro de tipo, não algo
 * que se descobre em revisão de código (ou em produção).
 */
export type UsuarioPublico = Pick<Usuario, 'id' | 'email' | 'papel'>;

/** A conversão, num lugar só. Campo por campo, nunca `delete u.senhaHash`. */
export const paraPublico = (u: Usuario): UsuarioPublico => ({
  id: u.id,
  email: u.email,
  papel: u.papel,
});

/** O que o repositório precisa para criar: já vem com o hash pronto. */
export type NovoUsuario = {
  email: string;
  senhaHash: string;
  papel: Papel;
};

/**
 * O contrato do repositório de usuários.
 *
 * `buscarPorEmail` existe porque o login não tem o `id` — a única coisa que o
 * usuário digita é o e-mail. Num banco de verdade isso pede um índice ÚNICO
 * sobre `email`: ele garante a unicidade (a checagem no service é uma corrida
 * perdida sob concorrência) e evita varredura de tabela a cada login.
 */
export type RepositorioUsuarios = {
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorEmail(email: string): Promise<Usuario | null>;
  criar(dados: NovoUsuario): Promise<Usuario>;
  atualizarSenha(id: number, senhaHash: string): Promise<Usuario | null>;
  listar(): Promise<Usuario[]>;
  contar(): Promise<number>;
};

/**
 * REFRESH TOKENS VÁLIDOS, indexados por `jti`.
 *
 * Este repositório é o que torna o logout possível — e é a parte que mais
 * tutorial de JWT esquece.
 *
 * O problema: um JWT assinado é auto-suficiente. Quem o tem entra até ele
 * expirar, mesmo que você apague o usuário do banco. Não existe "invalidar um
 * JWT": a assinatura continua fechando.
 *
 * A saída é guardar do lado do servidor um identificador do token (`jti`) e
 * conferi-lo. Repare no custo: você acabou de reintroduzir estado no servidor,
 * que era exatamente o que o JWT prometia eliminar. A escolha aqui é a do meio
 * termo mais comum:
 *
 *   ACCESS  — sem estado, verificado só pela assinatura, expira em 15 min
 *   REFRESH — com estado (esta tabela), revogável, expira em 7 dias
 *
 * Assim o custo de consultar o armazenamento é pago uma vez a cada 15 minutos,
 * não em toda requisição. Em produção isto é uma tabela ou um Redis com TTL.
 */
export type RegistroRefresh = {
  jti: string;
  usuarioId: number;
  criadoEm: Date;
};

export type RepositorioRefresh = {
  guardar(registro: RegistroRefresh): Promise<void>;
  buscar(jti: string): Promise<RegistroRefresh | null>;
  revogar(jti: string): Promise<boolean>;
  /** Usado no "trocar senha": derruba todas as sessões daquele usuário. */
  revogarDoUsuario(usuarioId: number): Promise<number>;
};
