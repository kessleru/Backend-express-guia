/**
 * Repositório de usuários em memória.
 *
 * Zero regra de negócio, como todo repositório: ele não sabe que e-mail é único
 * nem que o primeiro usuário vira admin. Ele guarda, busca e conta.
 *
 * O que ele guarda é `senhaHash` — a senha crua nunca chega até aqui. Repare na
 * assinatura de `criar`: ela recebe `NovoUsuario`, que já tem o hash pronto. O
 * repositório nem tem como gravar texto puro por engano.
 */
import type { NovoUsuario, RepositorioUsuarios, Usuario } from '../dominio/usuario.ts';

export function criarRepositorioUsuarios(iniciais: Usuario[] = []): RepositorioUsuarios {
  const usuarios: Usuario[] = iniciais.map((u) => ({ ...u }));
  let ultimoId = Math.max(0, ...usuarios.map((u) => u.id));

  const copiar = (u: Usuario): Usuario => ({ ...u });

  /**
   * E-mail é comparado em minúsculas.
   *
   * `Ana@Exemplo.com` e `ana@exemplo.com` são a MESMA caixa postal (a parte do
   * domínio é insensível a caixa por RFC, e nenhum provedor sério diferencia a
   * parte local). Sem normalizar, dá para criar duas contas com "e-mails
   * diferentes" que entregam no mesmo lugar — e o login com a caixa errada
   * falha sem explicação.
   *
   * A normalização acontece em DOIS lugares de propósito: `.toLowerCase()` no
   * schema Zod (entrada da API) e aqui (qualquer outro caminho, como um seed).
   * Num banco de verdade, o terceiro é um índice único sobre `lower(email)`.
   */
  const mesmoEmail = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  return {
    async buscarPorId(id) {
      const usuario = usuarios.find((u) => u.id === id);
      return usuario ? copiar(usuario) : null;
    },

    async buscarPorEmail(email) {
      const usuario = usuarios.find((u) => mesmoEmail(u.email, email));
      return usuario ? copiar(usuario) : null;
    },

    async criar(dados: NovoUsuario) {
      const usuario: Usuario = {
        id: ++ultimoId,
        email: dados.email.toLowerCase(),
        senhaHash: dados.senhaHash,
        papel: dados.papel,
        criadoEm: new Date(),
      };
      usuarios.push(usuario);
      return copiar(usuario);
    },

    async atualizarSenha(id, senhaHash) {
      const indice = usuarios.findIndex((u) => u.id === id);
      if (indice === -1) return null;

      const atualizado = copiar(usuarios[indice]!);
      atualizado.senhaHash = senhaHash;
      usuarios[indice] = atualizado;
      return copiar(atualizado);
    },

    async listar() {
      return usuarios.map(copiar);
    },

    async contar() {
      return usuarios.length;
    },
  };
}
