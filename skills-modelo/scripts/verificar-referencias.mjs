#!/usr/bin/env node
// Garante que o código de referência das skills oficiais é cópia fiel do projeto-modelo.
//
// Para cada arquivo em backend/src/main/resources/skills-oficiais/<slug>/referencia/**:
// - a 1ª linha é um comentário na sintaxe do arquivo com "origem: skills-modelo/<caminho>"
//   (// origem: ...   # origem: ...   <!-- origem: ... -->   /* origem: ... */);
// - o resto do arquivo tem de ser idêntico ao arquivo de origem (CRLF e LF contam como iguais);
// - sem a marca "origem: " na 1ª linha, só .md é aceito (modelo/documento, ex.: CLAUDE.modelo.md); nele, cada bloco
//   de código precedido de `<!-- arquivo: skills-modelo/<caminho> -->` é conferido com o arquivo (é assim que JSON
//   entra numa skill: .json é recusado, porque JSON não tem comentário para a linha de origem);
// - nenhum arquivo da skill pode se chamar CLAUDE.md (o Claude Code o carregaria como memória do projeto).
//
// Uso: node skills-modelo/scripts/verificar-referencias.mjs [--atualizar] [--raiz <pasta do repositório>]
//   --atualizar  reescreve as cópias e os blocos "arquivo:" divergentes a partir da origem (mantém a 1ª linha).
// Sai com código 1 listando as divergências.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA_SKILLS = path.join('backend', 'src', 'main', 'resources', 'skills-oficiais');
const PREFIXO_ORIGEM = 'skills-modelo/';

function argumentos(argv) {
  const opcoes = { raiz: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), atualizar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--atualizar') opcoes.atualizar = true;
    else if (argv[i] === '--raiz') opcoes.raiz = path.resolve(argv[++i] ?? '.');
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  return opcoes;
}

const normalizar = (texto) => texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const barras = (p) => p.split(path.sep).join('/');

function listarArquivos(pasta) {
  const encontrados = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = path.join(pasta, nome);
    if (statSync(caminho).isDirectory()) encontrados.push(...listarArquivos(caminho));
    else encontrados.push(caminho);
  }
  return encontrados;
}

/** Caminho depois de "origem: " até o primeiro espaço (o fechamento do comentário fica de fora). */
function lerOrigem(primeiraLinha) {
  const i = primeiraLinha.indexOf('origem: ');
  if (i < 0) return null;
  return primeiraLinha.slice(i + 'origem: '.length).trim().split(/\s+/)[0] ?? '';
}

function primeiraDiferenca(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) return { linha: i + 1, copia: la[i], origem: lb[i] };
  }
  return null;
}

/** Resolve "skills-modelo/<caminho>" dentro do repositório; devolve um texto de problema se não servir. */
function resolverOrigem(raiz, pastaModelo, origem) {
  const destino = path.resolve(raiz, origem);
  if (!origem.startsWith(PREFIXO_ORIGEM) || !destino.startsWith(pastaModelo + path.sep)) {
    return { problema: `origem "${origem}" deve ficar dentro de ${PREFIXO_ORIGEM}` };
  }
  if (!existsSync(destino)) return { problema: `origem ${origem} não existe` };
  return { destino };
}

function descreverDiferenca(nome, origem, copia, esperado, deslocamento) {
  const d = primeiraDiferenca(copia, esperado);
  return (
    `${nome}: diverge de ${origem} na linha ${(d?.linha ?? 0) + deslocamento} da cópia (linha ${d?.linha} da origem)\n` +
    `    cópia : ${JSON.stringify(d?.copia ?? '(fim do arquivo)')}\n` +
    `    origem: ${JSON.stringify(d?.origem ?? '(fim do arquivo)')}`
  );
}

const MARCA_BLOCO = /^<!-- arquivo: (\S+) -->$/;

/**
 * Documento .md sem origem (ex.: configuracao.md): cada bloco de código precedido da linha
 * `<!-- arquivo: skills-modelo/<caminho> -->` tem de ser igual ao arquivo (serve para JSON, que não aceita comentário).
 */
function conferirBlocos(ctx, nome, arquivo, texto) {
  const linhas = texto.split('\n');
  let mudou = false;
  for (let i = 0; i < linhas.length; i++) {
    const m = MARCA_BLOCO.exec(linhas[i]);
    if (!m) continue;
    const origem = m[1];
    const abertura = linhas[i + 1] ?? '';
    if (!abertura.startsWith('```')) {
      ctx.problemas.push(`${nome}: depois de "arquivo: ${origem}" (linha ${i + 1}) deve vir um bloco de código`);
      continue;
    }
    let fim = i + 2;
    while (fim < linhas.length && linhas[fim] !== '```') fim++;
    if (fim >= linhas.length) {
      ctx.problemas.push(`${nome}: bloco de ${origem} (linha ${i + 2}) não foi fechado`);
      continue;
    }
    const r = resolverOrigem(ctx.raiz, ctx.pastaModelo, origem);
    if (r.problema) {
      ctx.problemas.push(`${nome}: ${r.problema}`);
      continue;
    }
    ctx.conferidas++;
    const bloco = linhas.slice(i + 2, fim).join('\n') + '\n';
    const esperado = normalizar(readFileSync(r.destino, 'utf8'));
    if (bloco === esperado) continue;
    if (ctx.atualizar) {
      linhas.splice(i + 2, fim - (i + 2), ...esperado.replace(/\n$/, '').split('\n'));
      mudou = true;
      continue;
    }
    ctx.problemas.push(descreverDiferenca(nome, origem, bloco, esperado, i + 2));
  }
  if (mudou) {
    writeFileSync(arquivo, linhas.join('\n'));
    process.stdout.write(`atualizada: ${nome}\n`);
  }
}

function verificar({ raiz, atualizar }) {
  const pastaSkills = path.join(raiz, PASTA_SKILLS);
  const ctx = { raiz, atualizar, pastaModelo: path.join(raiz, 'skills-modelo'), problemas: [], semOrigem: [], conferidas: 0 };
  if (!existsSync(pastaSkills)) return { ...ctx, problemas: [`pasta não encontrada: ${pastaSkills}`] };

  for (const slug of readdirSync(pastaSkills).sort()) {
    const pastaSkill = path.join(pastaSkills, slug);
    if (!statSync(pastaSkill).isDirectory()) continue;
    // CLAUDE.md em qualquer lugar da skill seria carregado pelo Claude Code como memória do projeto.
    for (const arquivo of listarArquivos(pastaSkill)) {
      if (path.basename(arquivo) === 'CLAUDE.md') {
        ctx.problemas.push(`${barras(path.relative(pastaSkills, arquivo))}: não use o nome CLAUDE.md dentro da skill (use CLAUDE.modelo.md)`);
      }
    }
    const pastaRef = path.join(pastaSkill, 'referencia');
    if (!existsSync(pastaRef) || !statSync(pastaRef).isDirectory()) continue;
    for (const arquivo of listarArquivos(pastaRef).sort()) {
      const nome = barras(path.relative(pastaSkills, arquivo));
      if (path.basename(arquivo) === 'CLAUDE.md') continue;
      if (arquivo.endsWith('.json')) {
        ctx.problemas.push(`${nome}: .json não é permitido em referencia/ (sem comentário para a linha origem)`);
        continue;
      }
      const texto = normalizar(readFileSync(arquivo, 'utf8'));
      const quebra = texto.indexOf('\n');
      const primeira = quebra < 0 ? texto : texto.slice(0, quebra);
      const corpo = quebra < 0 ? '' : texto.slice(quebra + 1);
      const origem = lerOrigem(primeira);
      if (origem === null) {
        if (!arquivo.endsWith('.md')) {
          ctx.problemas.push(`${nome}: sem a linha origem na 1ª linha (só .md pode ser modelo/documento sem origem)`);
          continue;
        }
        ctx.semOrigem.push(nome);
        conferirBlocos(ctx, nome, arquivo, texto);
        continue;
      }
      const r = resolverOrigem(raiz, ctx.pastaModelo, origem);
      if (r.problema) {
        ctx.problemas.push(`${nome}: ${r.problema}`);
        continue;
      }
      ctx.conferidas++;
      const esperado = normalizar(readFileSync(r.destino, 'utf8'));
      if (corpo === esperado) continue;
      if (atualizar) {
        writeFileSync(arquivo, `${primeira}\n${esperado}`);
        process.stdout.write(`atualizada: ${nome}\n`);
        continue;
      }
      ctx.problemas.push(descreverDiferenca(nome, origem, corpo, esperado, 1));
    }
  }
  return ctx;
}

const opcoes = argumentos(process.argv.slice(2));
const { problemas, semOrigem, conferidas } = verificar(opcoes);
for (const nome of semOrigem) process.stdout.write(`sem origem (documento .md; só os blocos "arquivo:" são conferidos): ${nome}\n`);
if (problemas.length > 0) {
  process.stderr.write(`\n${problemas.length} divergência(s) entre referencia/ e skills-modelo/:\n`);
  for (const p of problemas) process.stderr.write(`  - ${p}\n`);
  process.stderr.write('\nCorrija a cópia ou rode com --atualizar para copiar de novo a partir do skills-modelo.\n');
  process.exit(1);
}
process.stdout.write(`OK: ${conferidas} ${conferidas === 1 ? 'referência conferida' : 'referências conferidas'}\n`);
