// Testes do verificar-referencias.mjs (node --test). Cada teste monta, numa pasta temporária, o mesmo desenho do
// repositório: skills-modelo/<código> e backend/src/main/resources/skills-oficiais/<slug>/referencia/<cópia>.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verificar-referencias.mjs');
const SKILLS = 'backend/src/main/resources/skills-oficiais';

let raiz;
beforeEach(() => {
  raiz = mkdtempSync(path.join(tmpdir(), 'verificar-ref-'));
});
afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
});

function escrever(relativo, conteudo) {
  const destino = path.join(raiz, relativo);
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, conteudo);
}

function rodar(...args) {
  const r = spawnSync(process.execPath, [SCRIPT, '--raiz', raiz, ...args], { encoding: 'utf8' });
  return { codigo: r.status, saida: `${r.stdout}${r.stderr}` };
}

const CODIGO = 'export const a = 1;\nexport const b = 2;\n';

test('cópia idêntica (só com a linha origem a mais) passa com código 0', () => {
  escrever('skills-modelo/apps/api/src/a.ts', CODIGO);
  escrever(`${SKILLS}/minha-skill/referencia/a.ts`, `// origem: skills-modelo/apps/api/src/a.ts\n${CODIGO}`);
  const r = rodar();
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /1 referência/);
});

test('divergência sai com código 1 e lista o arquivo e a linha', () => {
  escrever('skills-modelo/apps/api/src/a.ts', CODIGO);
  escrever(`${SKILLS}/minha-skill/referencia/a.ts`, `// origem: skills-modelo/apps/api/src/a.ts\nexport const a = 1;\nexport const b = 3;\n`);
  const r = rodar();
  assert.equal(r.codigo, 1, r.saida);
  assert.match(r.saida, /minha-skill\/referencia\/a\.ts/);
  assert.match(r.saida, /linha 2/);
});

test('CRLF na origem e LF na cópia não contam como divergência', () => {
  escrever('skills-modelo/.env.example', 'A=1\r\nB=2\r\n');
  escrever(`${SKILLS}/s/referencia/.env.example`, '# origem: skills-modelo/.env.example\nA=1\nB=2\n');
  assert.equal(rodar().codigo, 0);
});

test('aceita os comentários de cada sintaxe: #, <!-- -->, /* */', () => {
  escrever('skills-modelo/x.yml', 'a: 1\n');
  escrever('skills-modelo/x.md', '# Título\n');
  escrever('skills-modelo/x.css', 'a { color: red; }\n');
  escrever(`${SKILLS}/s/referencia/x.yml`, '# origem: skills-modelo/x.yml\na: 1\n');
  escrever(`${SKILLS}/s/referencia/x.md`, '<!-- origem: skills-modelo/x.md -->\n# Título\n');
  escrever(`${SKILLS}/s/referencia/x.css`, '/* origem: skills-modelo/x.css */\na { color: red; }\n');
  const r = rodar();
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /3 referências/);
});

test('origem apontando para arquivo que não existe é divergência', () => {
  escrever(`${SKILLS}/s/referencia/a.ts`, '// origem: skills-modelo/nao/existe.ts\nx\n');
  const r = rodar();
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /não existe/);
});

test('origem fora de skills-modelo/ é recusada', () => {
  escrever('outro/a.ts', 'x\n');
  escrever(`${SKILLS}/s/referencia/a.ts`, '// origem: skills-modelo/../outro/a.ts\nx\n');
  assert.equal(rodar().codigo, 1);
});

test('arquivo .json em referencia/ é recusado (JSON não tem comentário para a linha origem)', () => {
  escrever(`${SKILLS}/s/referencia/package.json`, '{}\n');
  const r = rodar();
  assert.equal(r.codigo, 1);
  assert.match(r.saida, /\.json/);
});

test('arquivo sem linha origem (modelo/documento, não cópia) é ignorado e citado', () => {
  escrever(`${SKILLS}/s/referencia/CLAUDE.md`, '# CLAUDE.md modelo\n');
  const r = rodar();
  assert.equal(r.codigo, 0, r.saida);
  assert.match(r.saida, /sem origem.*CLAUDE\.md/s);
});

test('--atualizar reescreve a cópia divergente a partir da origem', () => {
  escrever('skills-modelo/a.ts', CODIGO);
  const copia = `${SKILLS}/s/referencia/a.ts`;
  escrever(copia, '// origem: skills-modelo/a.ts\nvelho\n');
  assert.equal(rodar('--atualizar').codigo, 0);
  assert.equal(readFileSync(path.join(raiz, copia), 'utf8'), `// origem: skills-modelo/a.ts\n${CODIGO}`);
  assert.equal(rodar().codigo, 0);
});
