/**
 * PONTO DE MONTAGEM nº 1 — o núcleo plugado num adaptador HTTP.
 *
 * Rodar:  node src/exemplos/06-10/08-arquiteturas/02-hexagonal/servidor.ts
 *
 * O desenho do hexágono, com os nomes deste exemplo:
 *
 *   ENTRADA (condutores)          NÚCLEO                 SAÍDA (conduzidos)
 *   adaptadores/http  ──▶ ┌───────────────────┐ ──▶ adaptadores/memoria
 *   adaptadores/cli   ──▶ │ CatalogoDeCursos  │ ──▶ adaptadores/console
 *                         └───────────────────┘
 *
 * Todas as setas de IMPORT apontam para `nucleo/`. O núcleo não importa nenhum
 * adaptador — ele só declara as portas, e este arquivo decide quem pluga nelas.
 */
import express from 'express';
import { rotaNaoEncontrada, tratarErro } from '../../06-erros/tratador.ts';
import { criarNotificadorDeConsole } from './adaptadores/console/notificador.ts';
import { criarRotasHttp, traduzirErroDoNucleo } from './adaptadores/http/rotas.ts';
import { criarRepositorioEmMemoria } from './adaptadores/memoria/repositorio.ts';
import { cursosIniciais } from './dados-iniciais.ts';
import { criarCatalogo } from './nucleo/catalogo.ts';

// Plugar os adaptadores de saída nas portas de saída...
const catalogo = criarCatalogo(
  criarRepositorioEmMemoria(cursosIniciais),
  criarNotificadorDeConsole(),
);

// ...e o adaptador de entrada na porta de entrada.
const app = express();
app.use(express.json());
app.use('/api/v1/cursos', criarRotasHttp(catalogo));
app.use(rotaNaoEncontrada);
app.use(traduzirErroDoNucleo); // antes do tratador: converte o erro, não responde
app.use(tratarErro);

const PORT = 5082;
app.listen(PORT, () => {
  console.log(`Hexagonal em http://localhost:${PORT}/api/v1/cursos`);
});
