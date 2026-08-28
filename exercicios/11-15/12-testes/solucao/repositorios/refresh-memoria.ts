/**
 * Armazenamento dos refresh tokens válidos, indexado por `jti`.
 *
 * É a peça que transforma um token sem estado em algo revogável. Sem ela,
 * "logout" seria o front esquecer o token — e quem tivesse copiado continuaria
 * dentro por 7 dias.
 *
 * Um `Map` serve para estudar e denuncia três limites reais, todos os mesmos do
 * rate limiter do módulo 05:
 *
 *   1. **Morre no restart.** Reiniciar o processo desloga todo mundo.
 *   2. **Não é compartilhado.** Com 3 instâncias atrás de um load balancer, o
 *      logout feito na instância A não tem efeito nas B e C. Este é o furo de
 *      segurança, não só de conveniência.
 *   3. **Não expira sozinho.** O `jti` de um token que já venceu fica ocupando
 *      memória para sempre — vazamento lento, do tipo que só aparece em produção.
 *
 * Em produção: uma tabela (`refresh_tokens`, com índice em `jti` e limpeza
 * agendada) ou Redis com TTL, que resolve o item 3 de graça. É o mesmo raciocínio
 * do módulo 15: **estado compartilhado entre instâncias precisa sair do processo.**
 */
import type { RegistroRefresh, RepositorioRefresh } from '../dominio/usuario.ts';

export function criarRepositorioRefresh(): RepositorioRefresh {
  const porJti = new Map<string, RegistroRefresh>();

  return {
    async guardar(registro) {
      porJti.set(registro.jti, { ...registro });
    },

    async buscar(jti) {
      const registro = porJti.get(jti);
      return registro ? { ...registro } : null;
    },

    async revogar(jti) {
      return porJti.delete(jti);
    },

    async revogarDoUsuario(usuarioId) {
      // Varredura linear porque o índice aqui é o `jti`. Num banco isto seria
      // `DELETE FROM refresh_tokens WHERE usuario_id = ?` com índice em
      // `usuario_id` — a mesma consulta que a troca de senha precisa fazer para
      // derrubar todas as sessões de uma vez.
      let removidos = 0;
      for (const [jti, registro] of porJti) {
        if (registro.usuarioId === usuarioId) {
          porJti.delete(jti);
          removidos++;
        }
      }
      return removidos;
    },
  };
}
