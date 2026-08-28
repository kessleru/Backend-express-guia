/**
 * `RepositorioRefresh` sobre Prisma.
 *
 * A versão em memória (`refresh-memoria.ts`) lista três limites, e vale reler o
 * que este arquivo resolve e o que ele NÃO resolve:
 *
 *   | Limite do Map                      | Com a tabela                        |
 *   | ---------------------------------- | ----------------------------------- |
 *   | Morre no restart                   | ✅ resolvido                        |
 *   | Não é compartilhado entre réplicas | ✅ resolvido — é o furo de segurança |
 *   | Não expira sozinho                 | ❌ continua de pé                   |
 *
 * O segundo era o grave: com três instâncias, o logout feito na instância A não
 * tinha efeito nas B e C, e o token revogado continuava funcionando em dois
 * terços das requisições. Com uma tabela, todas as réplicas consultam a mesma
 * fonte.
 *
 * O terceiro sobrou de propósito. A linha de um refresh já vencido fica na
 * tabela para sempre, porque **banco relacional não tem TTL**: apagar por
 * expiração exige um job agendado, que é assunto do módulo 17. Redis resolveria
 * isto de graça (`SET ... EX 604800`) e é por isso que sessão costuma morar lá
 * em vez de numa tabela — módulo 15.
 */
import type { RegistroRefresh, RepositorioRefresh } from '../dominio/usuario.ts';
import { prisma } from '../db/prisma.ts';

/**
 * O CLIENTE ENTRA POR PARÂMETRO, com o singleton como padrão.
 *
 * Em produção ninguém passa nada: `criarRepositorioX()` usa a instância única de
 * `db/prisma.ts`, que é o certo (um pool por processo).
 *
 * O parâmetro existe para a suíte de contrato (`testes/repositorio.test.ts`)
 * poder apontar para um banco TEMPORÁRIO. Sem ele, testar a implementação real
 * significaria escrever no mesmo arquivo `.sqlite` do desenvolvimento — e a
 * suíte apagaria os dados com que você estava brincando.
 *
 * É a mesma injeção de dependência do módulo 08, um nível abaixo: o repositório
 * recebe o cliente em vez de alcançá-lo por conta própria.
 */
type ClientePrisma = typeof prisma;

export function criarRepositorioRefreshPrisma(
  cliente: ClientePrisma = prisma,
): RepositorioRefresh {
  return {
    /**
     * `upsert` e não `create`.
     *
     * O `jti` é a chave primária e vem de um `randomUUID()`, então colisão é
     * praticamente impossível — mas `create` sobre uma chave repetida lança
     * P2002, e esse erro subiria como 500 no meio de um login que estava
     * perfeitamente correto. `upsert` custa o mesmo e não tem esse modo de falha.
     */
    async guardar(registro: RegistroRefresh) {
      await cliente.refreshToken.upsert({
        where: { jti: registro.jti },
        create: {
          jti: registro.jti,
          usuarioId: registro.usuarioId,
          criadoEm: registro.criadoEm,
        },
        update: { usuarioId: registro.usuarioId, criadoEm: registro.criadoEm },
      });
    },

    async buscar(jti) {
      const registro = await cliente.refreshToken.findUnique({ where: { jti } });
      return registro
        ? {
            jti: registro.jti,
            usuarioId: registro.usuarioId,
            criadoEm: registro.criadoEm,
          }
        : null;
    },

    /**
     * Devolve `false` quando não havia o que revogar — e o service trata isso
     * como sucesso de propósito (ver o comentário do `logout`).
     *
     * `deleteMany` em vez de `delete` porque `delete` de uma chave inexistente
     * lança P2025. Aqui o "não achou" é caso normal, não erro: um logout com
     * token já expirado cai exatamente nele.
     */
    async revogar(jti) {
      const { count } = await cliente.refreshToken.deleteMany({ where: { jti } });
      return count > 0;
    },

    /**
     * Derruba todas as sessões do usuário — o que a troca de senha exige.
     *
     * Uma consulta só, e o índice em `usuario_id` é o que a torna barata. A
     * versão em memória varria o `Map` inteiro porque o índice dela era o `jti`.
     */
    async revogarDoUsuario(usuarioId) {
      const { count } = await cliente.refreshToken.deleteMany({ where: { usuarioId } });
      return count;
    },
  };
}
