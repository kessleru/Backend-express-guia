/**
 * Solução do exercício 12 — o servidor DEPOIS da extração do `criarApp()`.
 *
 * Rodar:
 *   node --env-file=.env exercicios/11-15/12-testes/solucao/servidor.ts
 *
 * Compare o tamanho deste arquivo com o do exercício 11. Tudo que era montagem
 * de app foi para `app.ts`; o que sobrou é exatamente o que NÃO se testa com
 * Supertest:
 *
 *   - escolher as implementações CONCRETAS de repositório;
 *   - os dados de partida;
 *   - a porta;
 *   - a rede de segurança do processo.
 *
 * Essa é a divisão certa: `app.ts` tem lógica e é testado; `servidor.ts` tem
 * decisões de ambiente e é verificado rodando.
 */
import { criarApp } from './app.ts';
import type { Autor } from './dominio/autor.ts';
import type { Livro } from './dominio/livro.ts';
import { criarRepositorioAutores } from './repositorios/autores-memoria.ts';
import { criarRepositorioEmprestimos } from './repositorios/emprestimos-memoria.ts';
import { criarRepositorioLivros } from './repositorios/livros-memoria.ts';
import { criarRepositorioRefresh } from './repositorios/refresh-memoria.ts';
import { criarRepositorioUsuarios } from './repositorios/usuarios-memoria.ts';
import { criarRepositorioAutoresPrisma } from './repositorios/autores-prisma.ts';
import { criarRepositorioEmprestimosPrisma } from './repositorios/emprestimos-prisma.ts';
import { criarRepositorioLivrosPrisma } from './repositorios/livros-prisma.ts';
import { criarRepositorioRefreshPrisma } from './repositorios/refresh-prisma.ts';
import { criarRepositorioUsuariosPrisma } from './repositorios/usuarios-prisma.ts';

const autoresIniciais: Autor[] = [
  { id: 1, nome: 'J.R.R. Tolkien', nacionalidade: 'britânica' },
  { id: 2, nome: 'Frank Herbert', nacionalidade: 'estadunidense' },
];

const livrosIniciais: Livro[] = [
  {
    id: 1,
    titulo: 'O Hobbit',
    autorId: 1,
    ano: 1937,
    isbn: '9788595084742',
    generos: ['fantasia'],
    disponivel: true,
  },
  { id: 2, titulo: 'Duna', autorId: 2, ano: 1965, generos: ['ficcao'], disponivel: true },
];

/**
 * A ESCOLHA DA IMPLEMENTAÇÃO — a única decisão que este arquivo existe para tomar.
 *
 * Repare no que NÃO precisou mudar para a API passar a persistir: nenhum
 * service, nenhum controller, nenhuma rota, nenhum teste. Eles conhecem as
 * interfaces de `dominio/`, não o Prisma. Trocar a linha abaixo troca o banco.
 *
 * Produção usa Prisma porque um servidor que guarda usuário em array perde todo
 * mundo no restart — e com três réplicas cada uma teria a sua lista. A memória
 * não some por isso: ela vira DUBLÊ DE TESTE, que é o papel legítimo dela, e é
 * o que faz a suíte rodar em segundos sem banco, sem migration e sem limpar
 * tabela entre casos.
 *
 * `REPO=memoria` sobe a API sem nenhum setup de banco, para comparar os dois.
 */
const usarMemoria = process.env.REPO === 'memoria';

function criarRepositorios() {
  if (usarMemoria) {
    // Os dados iniciais só valem aqui: em memória o "banco" nasce vazio a cada
    // boot. Com Prisma, quem semeia é `prisma/seed.ts`, uma vez.
    return {
      repoLivros: criarRepositorioLivros(livrosIniciais),
      repoAutores: criarRepositorioAutores(autoresIniciais),
      repoUsuarios: criarRepositorioUsuarios(),
      repoEmprestimos: criarRepositorioEmprestimos(),
      repoRefresh: criarRepositorioRefresh(),
    };
  }

  return {
    repoLivros: criarRepositorioLivrosPrisma(),
    repoAutores: criarRepositorioAutoresPrisma(),
    repoUsuarios: criarRepositorioUsuariosPrisma(),
    repoEmprestimos: criarRepositorioEmprestimosPrisma(),
    repoRefresh: criarRepositorioRefreshPrisma(),
  };
}

const app = criarApp(criarRepositorios());

process.on('unhandledRejection', (motivo) => {
  console.error('UNHANDLED REJECTION — encerrando:', motivo);
  process.exit(1);
});
process.on('uncaughtException', (erro) => {
  console.error('UNCAUGHT EXCEPTION — encerrando:', erro);
  process.exit(1);
});

const PORT = 4120;
app.listen(PORT, () => {
  console.log(`Biblioteca testada em http://localhost:${PORT}/api/v1`);
  console.log(
    `Persistência: ${usarMemoria ? 'MEMÓRIA (some no restart)' : 'Prisma + SQLite'}`,
  );
  if (!usarMemoria) {
    console.log('  Setup: npm run db:generate && npm run db:migrate && npm run db:seed');
    console.log('  Sem banco? Suba com  REPO=memoria node ...servidor.ts');
  }

  console.log('A suíte deste app roda com:  npm test\n');
});
