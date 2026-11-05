// origem: skills-modelo/apps/api/test/env-documentadas.spec.ts
// Toda variável do schema de configuração (src/config/config.ts) tem de estar documentada nos dois .env.example:
// o de desenvolvimento (skills-modelo/.env.example) e o de instalação (skills-modelo/deploy/.env.example).
// Falhou aqui = variável nova sem documentação para quem instala. Acrescente a linha `NOME=` (ou `# NOME=`) com um
// comentário dizendo para que serve.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { esquemaConfig } from '../src/config/config';

const raiz = path.resolve(__dirname, '..', '..', '..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

const variaveis = Object.keys(esquemaConfig.shape);
const arquivos = ['.env.example', 'deploy/.env.example'] as const;

const documentada = (conteudo: string, v: string) => new RegExp(`^(# ?)?${v}=`, 'm').test(conteudo);

describe('variáveis do schema documentadas', () => {
  it('o schema tem as variáveis básicas', () => {
    expect(variaveis).toEqual(expect.arrayContaining(['NODE_ENV', 'PORT', 'DATABASE_URL', 'LOG_LEVEL']));
  });

  describe.each(arquivos)('%s', (arquivo) => {
    const conteudo = ler(arquivo);
    it.each(variaveis)('documenta %s', (v) => {
      expect(documentada(conteudo, v)).toBe(true);
    });
  });

  it('o .env.example de desenvolvimento não documenta variável que o schema não conhece', () => {
    const citadas = [...ler('.env.example').matchAll(/^(?:# ?)?([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!);
    // NOME_ARQUIVO é a forma "segredo em arquivo" de NOME (src/config/segredo.ts).
    const desconhecidas = citadas.filter((v) => !variaveis.includes(v.replace(/_ARQUIVO$/, '')));
    expect(desconhecidas).toEqual([]);
  });
});
