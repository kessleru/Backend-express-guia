/**
 * `RepositorioUsuarios` sobre Prisma.
 *
 * Compare com `usuarios-memoria.ts` lado a lado: **o contrato é o mesmo, método
 * por método.** É o que a interface do módulo 08 comprou — o service de
 * autenticação não muda uma linha para falar com um banco de verdade.
 *
 * O que muda é o que sumiu daqui: o `Map`, o `ultimoId` incrementado à mão e as
 * cópias defensivas. O banco resolve os três (chave primária com
 * `AUTOINCREMENT`, e cada `findUnique` devolve um objeto novo).
 */
import type {
  NovoUsuario,
  Papel,
  RepositorioUsuarios,
  Usuario,
} from '../dominio/usuario.ts';
import { prisma } from '../db/prisma.ts';

/**
 * O que o banco devolve, traduzido para o domínio.
 *
 * O único campo que precisa de conversão é `papel`: no SQLite ele é `TEXT`,
 * porque **o Prisma não suporta `enum` neste provider** — e o `as Papel` é a
 * fronteira onde essa perda de tipo é assumida.
 *
 * O `as` é uma mentira controlada, e vale saber exatamente qual: ele afirma que
 * a coluna só contém `'leitor'` ou `'admin'`. Quem garante isso é o TypeScript
 * na escrita, não o banco. Um `UPDATE usuarios SET papel = 'Admin'` rodado à mão
 * no console passaria — e a comparação `papel === 'admin'` devolveria `false` em
 * silêncio. Em Postgres a coluna seria um `enum` de verdade e o banco recusaria.
 *
 * Este é o tipo de diferença que o módulo 10 avisa que o ORM **não** apaga.
 */
type UsuarioDoPrisma = {
  id: number;
  email: string;
  senhaHash: string;
  papel: string;
  criadoEm: Date;
};

const paraUsuario = (u: UsuarioDoPrisma): Usuario => ({
  id: u.id,
  email: u.email,
  senhaHash: u.senhaHash,
  papel: u.papel as Papel,
  criadoEm: u.criadoEm,
});

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

export function criarRepositorioUsuariosPrisma(
  cliente: ClientePrisma = prisma,
): RepositorioUsuarios {
  return {
    async buscarPorId(id) {
      const usuario = await cliente.usuario.findUnique({ where: { id } });
      return usuario ? paraUsuario(usuario) : null;
    },

    /**
     * O e-mail é normalizado para minúsculas ANTES da consulta.
     *
     * A versão em memória compara com `toLowerCase()` dos dois lados. Aqui não
     * dá: a comparação acontece dentro do banco, e **o SQLite compara texto de
     * forma sensível à caixa** por padrão. `findUnique({ email: 'Ana@X.com' })`
     * não acharia a linha gravada como `ana@x.com`.
     *
     * O Prisma tem `mode: 'insensitive'`, mas ele **só funciona em Postgres e
     * SQL Server** — em SQLite é ignorado, sem erro nenhum. Um filtro que parece
     * ligado e não está é pior que um que não existe.
     *
     * A defesa real é normalizar na ESCRITA (ver `criar`) e na leitura, como
     * aqui. Num banco de verdade some um terceiro: índice único sobre
     * `lower(email)`, para a unicidade não depender de disciplina do código.
     */
    async buscarPorEmail(email) {
      const usuario = await cliente.usuario.findUnique({
        where: { email: email.toLowerCase() },
      });
      return usuario ? paraUsuario(usuario) : null;
    },

    async criar(dados: NovoUsuario) {
      const usuario = await cliente.usuario.create({
        data: {
          email: dados.email.toLowerCase(),
          senhaHash: dados.senhaHash,
          papel: dados.papel,
        },
      });
      return paraUsuario(usuario);
    },

    async atualizarSenha(id, senhaHash) {
      try {
        const usuario = await cliente.usuario.update({
          where: { id },
          data: { senhaHash },
        });
        return paraUsuario(usuario);
      } catch {
        // `update` de id inexistente lança P2025; a interface pede `null`.
        return null;
      }
    },

    async listar() {
      const usuarios = await cliente.usuario.findMany({ orderBy: { id: 'asc' } });
      return usuarios.map(paraUsuario);
    },

    /**
     * `count` roda no banco.
     *
     * Este método parece trivial e é o que decide quem vira admin: o service usa
     * `contar() === 0` para dar `admin` ao primeiro cadastrado. Fazer
     * `(await listar()).length` traria a tabela inteira de usuários para a
     * memória do Node a cada registro — e num banco com 50 mil usuários isso é
     * uma consulta cara escondida atrás de uma linha inocente.
     */
    async contar() {
      return cliente.usuario.count();
    },
  };
}
