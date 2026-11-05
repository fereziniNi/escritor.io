#!/usr/bin/env node
// Garante que o código de referência das skills oficiais é cópia fiel do projeto-modelo.
//
// Para cada arquivo em backend/src/main/resources/skills-oficiais/<slug>/referencia/**:
// - a 1ª linha é um comentário na sintaxe do arquivo com "origem: skills-modelo/<caminho>"
//   (// origem: ...   # origem: ...   <!-- origem: ... -->   /* origem: ... */);
// - o resto do arquivo tem de ser idêntico ao arquivo de origem (CRLF e LF contam como iguais);
// - sem a marca "origem: " na 1ª linha, o arquivo é um modelo/documento (ex.: CLAUDE.md modelo) e é só citado;
// - .json é recusado (JSON não tem comentário para a linha de origem).
//
// Uso: node skills-modelo/scripts/verificar-referencias.mjs [--atualizar] [--raiz <pasta do repositório>]
//   --atualizar  reescreve as cópias divergentes a partir da origem (mantém a 1ª linha).
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

const normalizar = (texto) => texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
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

function verificar({ raiz, atualizar }) {
  const pastaSkills = path.join(raiz, PASTA_SKILLS);
  const pastaModelo = path.join(raiz, 'skills-modelo');
  const problemas = [];
  const semOrigem = [];
  let conferidas = 0;
  if (!existsSync(pastaSkills)) return { problemas: [`pasta não encontrada: ${pastaSkills}`], semOrigem, conferidas };

  for (const slug of readdirSync(pastaSkills).sort()) {
    const pastaRef = path.join(pastaSkills, slug, 'referencia');
    if (!existsSync(pastaRef) || !statSync(pastaRef).isDirectory()) continue;
    for (const arquivo of listarArquivos(pastaRef).sort()) {
      const nome = barras(path.relative(pastaSkills, arquivo));
      if (arquivo.endsWith('.json')) {
        problemas.push(`${nome}: .json não é permitido em referencia/ (sem comentário para a linha origem)`);
        continue;
      }
      const texto = normalizar(readFileSync(arquivo, 'utf8'));
      const quebra = texto.indexOf('\n');
      const primeira = quebra < 0 ? texto : texto.slice(0, quebra);
      const corpo = quebra < 0 ? '' : texto.slice(quebra + 1);
      const origem = lerOrigem(primeira);
      if (origem === null) {
        semOrigem.push(nome);
        continue;
      }
      const destino = path.resolve(raiz, origem);
      if (!origem.startsWith(PREFIXO_ORIGEM) || !destino.startsWith(pastaModelo + path.sep)) {
        problemas.push(`${nome}: origem "${origem}" deve ficar dentro de ${PREFIXO_ORIGEM}`);
        continue;
      }
      if (!existsSync(destino)) {
        problemas.push(`${nome}: origem ${origem} não existe`);
        continue;
      }
      conferidas++;
      const esperado = normalizar(readFileSync(destino, 'utf8'));
      if (corpo === esperado) continue;
      if (atualizar) {
        writeFileSync(arquivo, `${primeira}\n${esperado}`);
        process.stdout.write(`atualizada: ${nome}\n`);
        continue;
      }
      const d = primeiraDiferenca(corpo, esperado);
      problemas.push(
        `${nome}: diverge de ${origem} na linha ${(d?.linha ?? 0) + 1} da cópia (linha ${d?.linha} da origem)\n` +
          `    cópia : ${JSON.stringify(d?.copia ?? '(fim do arquivo)')}\n` +
          `    origem: ${JSON.stringify(d?.origem ?? '(fim do arquivo)')}`,
      );
    }
  }
  return { problemas, semOrigem, conferidas };
}

const opcoes = argumentos(process.argv.slice(2));
const { problemas, semOrigem, conferidas } = verificar(opcoes);
for (const nome of semOrigem) process.stdout.write(`sem origem (modelo/documento, não conferido): ${nome}\n`);
if (problemas.length > 0) {
  process.stderr.write(`\n${problemas.length} divergência(s) entre referencia/ e skills-modelo/:\n`);
  for (const p of problemas) process.stderr.write(`  - ${p}\n`);
  process.stderr.write('\nCorrija a cópia ou rode com --atualizar para copiar de novo a partir do skills-modelo.\n');
  process.exit(1);
}
process.stdout.write(`OK: ${conferidas} ${conferidas === 1 ? 'referência conferida' : 'referências conferidas'}\n`);
