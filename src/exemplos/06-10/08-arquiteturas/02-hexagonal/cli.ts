/**
 * PONTO DE MONTAGEM nº 2 — o MESMO núcleo plugado num terminal.
 *
 * Rodar:
 *   node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts listar
 *   node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 2
 *   node src/exemplos/06-10/08-arquiteturas/02-hexagonal/cli.ts publicar 3   # regra das 2h
 *
 * Compare com `servidor.ts`: as duas primeiras linhas de montagem são iguais.
 * Só o adaptador de entrada mudou. Nenhuma linha de `nucleo/` sabe qual dos dois
 * está rodando.
 *
 * (O repositório é em memória, então cada execução começa dos três cursos
 * iniciais. Com o adaptador SQLite do módulo 09, o que o terminal publica o
 * servidor enxergaria.)
 */
import { executarComando } from './adaptadores/cli/comandos.ts';
import { criarNotificadorDeConsole } from './adaptadores/console/notificador.ts';
import { criarRepositorioEmMemoria } from './adaptadores/memoria/repositorio.ts';
import { cursosIniciais } from './dados-iniciais.ts';
import { criarCatalogo } from './nucleo/catalogo.ts';

const catalogo = criarCatalogo(
  criarRepositorioEmMemoria(cursosIniciais),
  criarNotificadorDeConsole(),
);

// `process.exitCode` em vez de `process.exit()`: o primeiro deixa o Node
// terminar de escrever o que está no buffer do terminal antes de sair.
process.exitCode = await executarComando(catalogo, process.argv.slice(2));
