/**
 * Insere um sumário navegável no topo de cada docs/NN-*.md.
 *
 * Regras:
 * - Markdown puro (âncoras `[Título](#titulo)`), que o GitHub e o preview do
 *   VS Code resolvem sozinhos. Nada de @import "[TOC]".
 * - Entra depois do bloco "**Em uma frase:**" e antes do primeiro "## ".
 * - Lista todos os `##`, e aninha os `###` só dentro de `## Conceitos`, que é
 *   a seção longa — é lá que alguém com uma dúvida específica vai procurar.
 * - Idempotente: se o sumário já existe, ele é substituído.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DOCS = 'docs';
const INICIO = '<!-- sumario:inicio -->';
const FIM = '<!-- sumario:fim -->';

/** Mesma regra de âncora do GitHub: minúsculas, espaço vira hífen, acento fica. */
const ancora = (t) =>
  t
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');

/** Tira marcação inline do título para o texto do link ficar limpo. */
const limpo = (t) => t.replace(/`/g, '').replace(/\*\*/g, '').replace(/_/g, '');

// `recursive` porque os módulos moram em grupos de cinco (`docs/06-10/...`), e
// o glossário fica solto na raiz de `docs/`. O filtro é pelo NOME do arquivo,
// não pelo caminho: a pasta `06-10` também começa com dois dígitos.
const docs = readdirSync(DOCS, { recursive: true })
  .map((f) => String(f).replaceAll('\\', '/'))
  .filter((f) => /^\d\d-.*\.md$/.test(f.split('/').pop()));

for (const arquivo of docs) {
  const caminho = join(DOCS, arquivo);
  let texto = readFileSync(caminho, 'utf8');

  // Remove um sumário anterior, se houver.
  const jaTem = new RegExp(`${INICIO}[\\s\\S]*?${FIM}\\n\\n`, 'g');
  texto = texto.replace(jaTem, '');

  const linhas = texto.split('\n');
  const itens = [];
  let dentroDeConceitos = false;
  let emBlocoDeCodigo = false;

  for (const linha of linhas) {
    // Um `###` dentro de bloco de código não é título.
    if (linha.startsWith('```')) emBlocoDeCodigo = !emBlocoDeCodigo;
    if (emBlocoDeCodigo) continue;

    if (linha.startsWith('## ')) {
      const titulo = linha.slice(3).trim();
      dentroDeConceitos = titulo === 'Conceitos';
      itens.push(`- [${limpo(titulo)}](#${ancora(titulo)})`);
    } else if (linha.startsWith('### ') && dentroDeConceitos) {
      const titulo = linha.slice(4).trim();
      itens.push(`  - [${limpo(titulo)}](#${ancora(titulo)})`);
    }
  }

  if (itens.length < 3) {
    console.log(`- ${arquivo}: pulado (${itens.length} seções)`);
    continue;
  }

  const sumario = `${INICIO}\n\n**Sumário**\n\n${itens.join('\n')}\n\n${FIM}\n\n`;

  // Insere antes do primeiro `## ` que não esteja em bloco de código.
  const idx = texto.indexOf('\n## ');
  if (idx === -1) {
    console.log(`- ${arquivo}: pulado (nenhum \\n## encontrado)`);
    continue;
  }
  texto = texto.slice(0, idx + 1) + sumario + texto.slice(idx + 1);

  writeFileSync(caminho, texto);
  console.log(`✓ ${arquivo}: ${itens.length} entradas`);
}
