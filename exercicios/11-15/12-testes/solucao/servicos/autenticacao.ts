/**
 * Service de autenticação: registrar, login, refresh, logout, trocar senha.
 *
 * Como todo service (módulo 08), não importa `express`: não conhece `req`, `res`,
 * cookie nem status code. Ele recebe dados e devolve dados ou lança `AppError`.
 * É o que permite chamar `registrar()` de um seed, de um script de importação ou
 * de um teste sem servidor (módulo 12).
 *
 * A tradução para HTTP — onde o refresh vai (cookie), qual status sai — é
 * decisão do controller. Repare que isso não é purismo: o refresh em cookie
 * `httpOnly` só faz sentido para navegador; um app mobile recebe o mesmo token no
 * corpo. Se a decisão estivesse aqui, o service serviria a um cliente só.
 */
import type {
  RepositorioRefresh,
  RepositorioUsuarios,
  Usuario,
  UsuarioPublico,
} from '../dominio/usuario.ts';
import { paraPublico } from '../dominio/usuario.ts';
import { conflito, naoAutenticado, naoEncontrado } from '../erros/AppError.ts';
import { conferirSenha, gastarTempoDeHash, hashSenha } from '../auth/senhas.ts';
import {
  gerarAcesso,
  gerarRefresh,
  verificarRefresh,
  SEGUNDOS_ACESSO,
} from '../auth/tokens.ts';

/** O que o login devolve. O controller decide onde cada parte vai. */
export type Sessao = {
  usuario: UsuarioPublico;
  accessToken: string;
  refreshToken: string;
  expiraEm: number;
};

export function criarServicoAutenticacao(
  repoUsuarios: RepositorioUsuarios,
  repoRefresh: RepositorioRefresh,
) {
  /** Emitir o par de tokens e registrar o `jti`. Usado no login e no refresh. */
  async function abrirSessao(usuario: Usuario): Promise<Sessao> {
    const { token: refreshToken, jti } = gerarRefresh(usuario.id);

    // O `jti` é gravado ANTES de a resposta sair. Se gravar depois e o processo
    // cair no meio, o usuário fica com um refresh que o servidor não reconhece —
    // e é deslogado sem motivo aparente.
    await repoRefresh.guardar({ jti, usuarioId: usuario.id, criadoEm: new Date() });

    return {
      usuario: paraPublico(usuario),
      accessToken: gerarAcesso(usuario.id, usuario.papel),
      refreshToken,
      expiraEm: SEGUNDOS_ACESSO,
    };
  }

  return {
    async registrar(email: string, senha: string): Promise<UsuarioPublico> {
      // ---------------------------------------------------------------
      // O DILEMA DO 409
      // ---------------------------------------------------------------
      // Responder 409 aqui CONFIRMA que aquele e-mail tem conta. É enumeração de
      // usuários: dá para descobrir se alguém usa o serviço sem nunca logar.
      //
      // A alternativa mais segura é responder 201 sempre e mandar um e-mail
      // ("alguém tentou criar conta com seu endereço"). Custa infraestrutura de
      // e-mail e piora a experiência de quem só esqueceu que já tinha conta.
      //
      // Para uma API de estudo: 409, com o trade-off explícito. O que não vale é
      // escolher sem saber que havia escolha.
      const existente = await repoUsuarios.buscarPorEmail(email);
      if (existente) throw conflito('E-mail já cadastrado');

      // O PRIMEIRO usuário vira admin — senão ninguém consegue criar o primeiro
      // livro e a API nasce travada. Em produção isso é um comando de CLI ou um
      // seed, nunca uma regra automática: quem chegar primeiro no seu servidor
      // recém-subido vira administrador dele.
      const papel = (await repoUsuarios.contar()) === 0 ? 'admin' : 'leitor';

      // `senha` (o texto puro) morre nesta linha. Não é guardada em variável de
      // escopo maior, não é logada, não volta na resposta.
      const usuario = await repoUsuarios.criar({
        email,
        senhaHash: await hashSenha(senha),
        papel,
      });

      // O tipo de retorno é `UsuarioPublico`: `return usuario` NÃO COMPILA.
      // O vazamento do hash vira erro de tipo em vez de descoberta em produção.
      return paraPublico(usuario);
    },

    async login(email: string, senha: string): Promise<Sessao> {
      const usuario = await repoUsuarios.buscarPorEmail(email);

      if (!usuario) {
        // Gastar o mesmo tempo do caso "existe mas errou a senha".
        //
        // Sem isso, a mensagem genérica não adianta: "não existe" responde em 1ms
        // e "senha errada" em ~200ms, e o atacante mede o relógio para enumerar
        // contas. **Um canal lateral vaza tanto quanto a mensagem.**
        await gastarTempoDeHash();
        throw naoAutenticado('E-mail ou senha inválidos');
      }

      if (!(await conferirSenha(usuario.senhaHash, senha))) {
        // A MESMA mensagem e o MESMO status do caso acima, palavra por palavra.
        // Qualquer diferença — inclusive um ponto final — reabre a enumeração.
        throw naoAutenticado('E-mail ou senha inválidos');
      }

      return abrirSessao(usuario);
    },

    /**
     * Troca um refresh válido por um par novo.
     *
     * ROTAÇÃO: o refresh usado é invalidado e outro é emitido. O ganho é
     * detecção de roubo — se um atacante copiou o token e o usuário legítimo
     * renovar, o do atacante para de funcionar (e vice-versa). Um sistema mais
     * completo detecta a REUTILIZAÇÃO de um `jti` já rotacionado e revoga a
     * sessão inteira, porque reuso só acontece quando existem duas cópias.
     */
    async renovar(refreshToken: string): Promise<Sessao> {
      // 1. Assinatura e expiração. Falhou, nem chega a consultar o repositório.
      const payload = verificarRefresh(refreshToken);

      // 2. A checagem que a assinatura NÃO faz: este `jti` ainda vale?
      //    É exatamente aqui que o logout tem efeito.
      const registro = await repoRefresh.buscar(payload.jti);
      if (!registro) throw naoAutenticado('Refresh token revogado');

      // 3. O usuário ainda existe? Um token continua assinado e válido mesmo
      //    depois de a conta ser apagada — o JWT não sabe disso.
      const usuario = await repoUsuarios.buscarPorId(Number(payload.sub));
      if (!usuario) throw naoAutenticado('Usuário não existe mais');

      await repoRefresh.revogar(payload.jti);
      return abrirSessao(usuario);
    },

    /**
     * Logout: apaga o `jti`.
     *
     * Nunca falha. Recusar um pedido de sair porque o token já estava inválido
     * não protege nada e deixa o usuário preso numa tela de erro — e o efeito
     * desejado (não conseguir renovar) já está garantido.
     *
     * O QUE ELE NÃO FAZ: o ACCESS token continua válido até expirar, até 15 min
     * depois. É a natureza do JWT sem estado. Logout instantâneo exigiria
     * consultar uma lista de revogação em TODA requisição — e aí você abriu mão
     * do "stateless" que motivou usar JWT. Se o produto exige isso, sessão com
     * cookie era a escolha certa desde o começo.
     */
    async logout(refreshToken: string | undefined): Promise<void> {
      if (!refreshToken) return;
      try {
        await repoRefresh.revogar(verificarRefresh(refreshToken).jti);
      } catch {
        // Token já expirado ou forjado: nada a revogar, e o logout é sucesso.
      }
    },

    async buscarPublico(id: number): Promise<UsuarioPublico> {
      const usuario = await repoUsuarios.buscarPorId(id);
      if (!usuario) throw naoEncontrado('Usuário', id);
      return paraPublico(usuario);
    },

    async listarPublicos(): Promise<UsuarioPublico[]> {
      // Mesmo numa rota de admin, `senhaHash` não sai. Admin não precisa do hash
      // para nada, e um vazamento a partir do painel administrativo é vazamento
      // igual.
      return (await repoUsuarios.listar()).map(paraPublico);
    },

    /**
     * Desafio extra: trocar senha exige a senha ATUAL, mesmo já autenticado.
     *
     * Por que, se o token já prova quem é? Porque o token prova que a SESSÃO é
     * legítima, não que quem está no teclado é o dono. Quem senta no computador
     * destravado de outra pessoa tem a sessão; a senha atual é o que ele não tem.
     *
     * Vale o mesmo raciocínio para trocar e-mail, apagar a conta e mexer em meio
     * de pagamento. Princípio: **operação que muda as credenciais pede a
     * credencial de novo** (reautenticação por passo).
     */
    async trocarSenha(
      usuarioId: number,
      senhaAtual: string,
      novaSenha: string,
    ): Promise<number> {
      const usuario = await repoUsuarios.buscarPorId(usuarioId);
      if (!usuario) throw naoEncontrado('Usuário', usuarioId);

      if (!(await conferirSenha(usuario.senhaHash, senhaAtual))) {
        throw naoAutenticado('Senha atual incorreta');
      }

      await repoUsuarios.atualizarSenha(usuarioId, await hashSenha(novaSenha));

      // Trocar a senha DERRUBA todas as sessões — inclusive a atual.
      //
      // É o comportamento certo: o motivo mais comum para trocar senha é
      // suspeitar que alguém a tem. Se as sessões antigas continuassem valendo, a
      // troca não expulsaria o invasor, que era o ponto.
      return repoRefresh.revogarDoUsuario(usuarioId);
    },
  };
}

export type ServicoAutenticacao = ReturnType<typeof criarServicoAutenticacao>;
