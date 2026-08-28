/**
 * Gera as imagens de terminal do README a partir de saída REAL capturada.
 *
 * Rodar:  node assets/gerar.mjs
 *
 * O princípio: **a imagem do README é gerada, não desenhada.** Screenshot
 * desatualizado é pior que nenhum — se a saída do comando muda, este script
 * regera o SVG e a mentira não sobrevive a um commit.
 *
 * A entrada é texto com códigos ANSI (o mesmo que o terminal recebe); a saída é
 * SVG, que escala em qualquer tela e pesa poucos KB — PNG de screenshot precisa
 * de 2x para não borrar em retina e pesa 100x mais.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAIDA = join(import.meta.dirname, '.');

// Paleta do terminal. Fundo escuro fixo: ao contrário de um banner claro, ele
// funciona nos dois temas do GitHub (é o que um terminal parece de verdade).
const TEMA = {
  fundo: '#0d1117',
  borda: '#30363d',
  barra: '#161b22',
  texto: '#c9d1d9',
  fraco: '#7d8590',
};

// ANSI SGR → cor. Só os códigos que as ferramentas do repo realmente emitem.
const CORES_ANSI = {
  30: '#484f58',
  31: '#ff7b72', // vermelho — ERROR
  32: '#7ee787', // verde — INFO, teste passando
  33: '#f2cc60', // amarelo — WARN
  34: '#79c0ff',
  35: '#d2a8ff', // magenta — chaves do log
  36: '#a5d6ff', // ciano — mensagem
  37: '#c9d1d9',
  90: '#7d8590',
  91: '#ffa198',
  92: '#56d364',
  93: '#e3b341',
  94: '#a5d6ff',
  95: '#d2a8ff',
  96: '#a5d6ff',
  97: '#f0f6fc',
};

const escapar = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Quebra uma linha com códigos ANSI em trechos `{ texto, cor, negrito }`.
 * Sem isto o SVG mostraria o lixo `[32m` no meio do texto.
 */
function lerAnsi(linha) {
  const trechos = [];
  let cor = null;
  let negrito = false;
  let resto = linha;

  const RE = /\x1b\[([0-9;]*)m/;
  let m;
  while ((m = RE.exec(resto)) !== null) {
    if (m.index > 0) trechos.push({ texto: resto.slice(0, m.index), cor, negrito });
    for (const codigo of m[1].split(';').map(Number)) {
      if (codigo === 0) ((cor = null), (negrito = false));
      else if (codigo === 1) negrito = true;
      else if (codigo === 22) negrito = false;
      else if (codigo === 39) cor = null;
      else if (CORES_ANSI[codigo]) cor = CORES_ANSI[codigo];
    }
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) trechos.push({ texto: resto, cor, negrito });
  return trechos.length ? trechos : [{ texto: '', cor: null, negrito: false }];
}

const comprimento = (linha) => lerAnsi(linha).reduce((n, t) => n + t.texto.length, 0);

/**
 * @param {{ titulo: string, linhas: string[], arquivo: string, colunas?: number }} opcoes
 */
function terminal({ titulo, linhas, arquivo, colunas }) {
  const FONTE = 13; // px
  const LARGURA_CHAR = FONTE * 0.6; // métrica de fonte monoespaçada
  const ALTURA_LINHA = 20;
  const PADDING = 18;
  const BARRA = 34;

  // Zona morta da barra: as três bolinhas ocupam a esquerda e o canto
  // arredondado come a direita. O título vive só no espaço que sobra — sem esta
  // reserva ele passa por cima dos botões quando o nome do comando é longo.
  const FONTE_TITULO = 12;
  const CHAR_TITULO = FONTE_TITULO * 0.6;
  const ZONA_BOTOES = 82; // 3 círculos de r=5 + respiro
  const MARGEM_CANTO = 24;

  const cols = colunas ?? Math.max(...linhas.map(comprimento));
  const larguraMinima = ZONA_BOTOES + titulo.length * CHAR_TITULO + MARGEM_CANTO;
  const largura = Math.ceil(Math.max(cols * LARGURA_CHAR + PADDING * 2, larguraMinima));
  const altura = BARRA + PADDING + linhas.length * ALTURA_LINHA + PADDING;

  // Centralizado no espaço útil, não na imagem inteira.
  const xTitulo = ZONA_BOTOES + (largura - ZONA_BOTOES - MARGEM_CANTO) / 2;

  const corpo = linhas
    .map((linha, i) => {
      const y = BARRA + PADDING + (i + 1) * ALTURA_LINHA - 6;
      const spans = lerAnsi(linha)
        .map(
          (t) =>
            `<tspan${t.cor ? ` fill="${t.cor}"` : ''}${
              t.negrito ? ' font-weight="600"' : ''
            }>${escapar(t.texto)}</tspan>`,
        )
        .join('');
      return `    <text x="${PADDING}" y="${y}" xml:space="preserve">${spans}</text>`;
    })
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" role="img" aria-label="${escapar(titulo)}">
  <rect width="${largura}" height="${altura}" rx="10" fill="${TEMA.fundo}" stroke="${TEMA.borda}"/>
  <path d="M0 10a10 10 0 0 1 10-10h${largura - 20}a10 10 0 0 1 10 10v${BARRA - 10}H0z" fill="${TEMA.barra}"/>
  <line x1="0" y1="${BARRA}" x2="${largura}" y2="${BARRA}" stroke="${TEMA.borda}"/>
  <circle cx="18" cy="17" r="5" fill="#ff5f57"/>
  <circle cx="36" cy="17" r="5" fill="#febc2e"/>
  <circle cx="54" cy="17" r="5" fill="#28c840"/>
  <text x="${xTitulo}" y="22" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace,'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji'" font-size="${FONTE_TITULO}" fill="${TEMA.fraco}">${escapar(titulo)}</text>
  <g font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace,'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji'" font-size="${FONTE}" fill="${TEMA.texto}">
${corpo}
  </g>
</svg>
`;

  writeFileSync(join(SAIDA, arquivo), svg);
  console.log(`✓ ${arquivo}  (${largura}×${altura})`);
}

// ---------------------------------------------------------------------
// As cenas. Todo texto abaixo foi COPIADO de uma execução real — nada aqui
// é inventado. Ao mudar um exemplo, rode de novo e cole a saída nova.
// ---------------------------------------------------------------------

const v = '\x1b[32m';
const a = '\x1b[33m';
const r = '\x1b[31m';
const c = '\x1b[36m';
const m = '\x1b[35m';
const f = '\x1b[90m';
const _ = '\x1b[0m';

terminal({
  arquivo: 'quickstart.svg',
  titulo: 'npm run dev',
  colunas: 74,
  linhas: [
    `${f}$${_} npm run dev`,
    '',
    `${f}>${_} node --watch --env-file-if-exists=.env src/server.ts`,
    '',
    `Servidor rodando em ${c}http://localhost:5050${_}`,
    '',
    `${f}$${_} curl -s localhost:5050 | jq`,
    '',
    `{`,
    `  ${m}"mensagem"${_}: ${v}"Servidor no ar 🚀"${_},`,
    `  ${m}"proximosPassos"${_}: [`,
    `    ${v}"Leia o README.md para o índice do curso"${_},`,
    `    ${v}"Comece por docs/01-05/01-fundamentos-http.md"${_},`,
    `    ${v}"Escreva seu próprio código em src/playground/"${_}`,
    `  ]`,
    `}`,
  ],
});

terminal({
  arquivo: 'modulo-14-logs.svg',
  titulo: 'módulo 14 · servidor.ts | pino-pretty',
  colunas: 66,
  linhas: [
    `[14:52:04] ${v}INFO${_}: ${c}GET /livros → 200${_}`,
    `    ${m}responseTime${_}: 4`,
    `[14:52:04] ${v}INFO${_}: ${c}tentativa de login${_}`,
    `    ${m}corpo${_}: {`,
    `      "email": "ana@biblioteca.dev",`,
    `      "senha": "[REDACTED]"      ${f}← redigido por configuração${_}`,
    `    }`,
    `[14:52:04] ${a}WARN${_}: ${c}livro não encontrado${_}`,
    `    ${m}id${_}: 999`,
    `[14:52:04] ${r}ERROR${_}: ${c}erro não tratado na rota${_}`,
    `    ${m}err${_}: falha proposital para ver a stack no log`,
    `    ${m}req.id${_}: d7d9b848-3bd3-44d6-8acd-8fc14fc4c938`,
  ],
});

terminal({
  arquivo: 'modulo-13-rate-limit.svg',
  titulo: 'módulo 13 · seis tentativas de login seguidas',
  colunas: 46,
  linhas: [
    `${f}$${_} for i in $(seq 6); do curl -s -o /dev/null \\`,
    `${f} ${_}    -w '%{http_code}\\n' -X POST \\`,
    `${f} ${_}    localhost:5063/auth/login ...; done`,
    '',
    `${a}401${_}  ${f}credencial inválida${_}`,
    `${a}401${_}`,
    `${a}401${_}`,
    `${a}401${_}`,
    `${a}401${_}`,
    `${r}429${_}  ${f}Too Many Requests — o rate limit cortou${_}`,
  ],
});

terminal({
  arquivo: 'testes.svg',
  titulo: 'npm test',
  colunas: 46,
  linhas: [
    ` ${v}RUN${_}  v4.1.10  backend-express`,
    '',
    ` Test Files  ${v}10 passed${_} (10)`,
    `      Tests  ${v}113 passed${_} (113)`,
    `   Duration  12.94s`,
  ],
});
