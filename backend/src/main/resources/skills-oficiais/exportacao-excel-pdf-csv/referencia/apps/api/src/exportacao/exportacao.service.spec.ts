// origem: skills-modelo/apps/api/src/exportacao/exportacao.service.spec.ts
import { EventEmitter } from 'node:events';
import { type Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { type Config } from '../config/config';
import { type AuditoriaService } from '../auditoria/auditoria.service';
import { type UsuarioAtual } from '../usuarios/usuario-atual';
import { type Response } from 'express';
import { colunasPessoaisSemMascara, enviarArquivo, ExportacaoService, type FonteLinhas } from './exportacao.service';

const config = { EXPORTACAO_MAX_LINHAS: 5, NOME_SISTEMA: 'Sistema Exemplo' } as unknown as Config;
const usuario: UsuarioAtual = { id: 'u1', email: 'u@exemplo.com.br', nome: 'U', papel: 'USUARIO' };
const gestor: UsuarioAtual = { ...usuario, papel: 'GESTOR' };
const colunas = [
  { chave: 'nome', titulo: 'Nome', tipo: 'texto' as const },
  { chave: 'cpf', titulo: 'CPF', tipo: 'texto' as const },
];

/** Fonte falsa com `total` linhas em lotes de 2; registra quantos lotes foram realmente lidos. */
function fonte(total: number): FonteLinhas & { lidos: () => number } {
  let lidos = 0;
  return {
    lidos: () => lidos,
    contar: (max) => Promise.resolve(Math.min(total, max)),
    lotes: async function* () {
      for (let i = 0; i < total; i += 2) {
        await Promise.resolve();
        lidos++;
        yield Array.from({ length: Math.min(2, total - i) }, (_, k) => ({ nome: `P${i + k}`, cpf: '12345678909' }));
      }
    },
  };
}

const ler = async (r: Readable | Buffer) => {
  if (Buffer.isBuffer(r)) return r.toString('utf8');
  const partes: Buffer[] = [];
  for await (const p of r) partes.push(p as Buffer);
  return Buffer.concat(partes).toString('utf8');
};

function montar() {
  const registrar = vi.fn(() => Promise.resolve());
  return { registrar, servico: new ExportacaoService(config, { registrar } as unknown as AuditoriaService) };
}

describe('ExportacaoService', () => {
  it('nome-base com aspas, ponto e vírgula e quebra de linha não injeta cabeçalho em Content-Disposition', async () => {
    const { servico } = montar();
    const arquivo = await servico.exportar(gestor, {
      recurso: 'cliente',
      formato: 'csv',
      titulo: 'T',
      colunas,
      fonte: fonte(1),
      nomeBase: 'x"; filename=evil.exe\r\nSet-Cookie: a=b',
    });
    expect(arquivo.contentDisposition).not.toMatch(/[\r\n]/);
    expect(arquivo.contentDisposition).toMatch(/^attachment; filename="[A-Za-z0-9._-]+"; filename\*=UTF-8''[A-Za-z0-9._~%-]+$/);
  });

  it('grava a auditoria ANTES de entregar qualquer byte; se a trilha falhar, nada é entregue e nenhum lote é lido', async () => {
    const f = fonte(3);
    const registrar = vi.fn(() => Promise.reject(new Error('trilha fora')));
    const servico = new ExportacaoService(config, { registrar } as unknown as AuditoriaService);
    await expect(servico.exportar(gestor, { recurso: 'cliente', formato: 'xlsx', titulo: 'T', colunas, fonte: f })).rejects.toThrow('trilha fora');
    expect(f.lidos()).toBe(0);
  });

  it('corta no limite, avisa o corte e registra linhas/truncado', async () => {
    const { servico, registrar } = montar();
    const arquivo = await servico.exportar(gestor, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: fonte(9) });
    expect(arquivo.truncado).toBe(true);
    const linhas = (await ler(arquivo.conteudo)).trim().split('\r\n');
    expect(linhas).toHaveLength(1 + 5);
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'cliente.exportar', depois: expect.objectContaining({ linhas: 5, truncado: true, mascarado: false }) }));
  });

  it('mascara lote a lote para USUARIO e não para GESTOR', async () => {
    const { servico } = montar();
    const comum = await ler((await servico.exportar(usuario, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: fonte(3) })).conteudo);
    expect(comum).toContain('***.456.789-**');
    expect(comum).not.toContain('12345678909');
    const total = await ler((await servico.exportar(gestor, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: fonte(3) })).conteudo);
    expect(total).toContain('12345678909');
  });

  it('Excel e CSV só leem os lotes quando o fluxo é consumido (nada na memória antes)', async () => {
    const { servico } = montar();
    const f = fonte(4);
    const arquivo = await servico.exportar(gestor, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: f });
    expect(f.lidos()).toBe(0);
    await ler(arquivo.conteudo);
    expect(f.lidos()).toBe(2);
  });
});

describe('colunasPessoaisSemMascara', () => {
  it('aponta chave com cpf/email no nome que não começa com cpf/email (a máscara por papel não agiria)', () => {
    const lista = colunasPessoaisSemMascara([
      { chave: 'cpf', titulo: 'a', tipo: 'texto' },
      { chave: 'emailContato', titulo: 'b', tipo: 'texto' },
      { chave: 'titularCpf', titulo: 'c', tipo: 'texto' },
      { chave: 'contatoEmail', titulo: 'd', tipo: 'texto' },
      { chave: 'nome', titulo: 'e', tipo: 'texto' },
    ]);
    expect(lista).toEqual(['titularCpf', 'contatoEmail']);
  });
});

describe('enviarArquivo: desconexão do cliente', () => {
  const respostaFalsa = () => Object.assign(new EventEmitter(), { setHeader: vi.fn(), writableFinished: false });

  it('fechar a resposta antes do fim destrói o fluxo e encerra o gerador de lotes (nenhum lote novo é lido)', async () => {
    const { servico } = montar();
    const f = fonte(2000);
    const arquivo = await servico.exportar({ ...usuario, papel: 'ADMIN' }, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: f });
    const res = respostaFalsa();
    enviarArquivo(res as unknown as Response, arquivo);
    const fluxo = arquivo.conteudo as Readable;
    await new Promise<void>((ok) => {
      fluxo.once('data', () => ok());
      fluxo.resume();
    });
    res.emit('close');
    expect(fluxo.destroyed).toBe(true);
    await new Promise((ok) => setTimeout(ok, 50));
    const lidos = f.lidos();
    await new Promise((ok) => setTimeout(ok, 100));
    expect(f.lidos()).toBe(lidos);
    expect(lidos).toBeLessThan(1000);
  });

  it('fechar depois de terminar de escrever não faz nada', async () => {
    const { servico } = montar();
    const arquivo = await servico.exportar(gestor, { recurso: 'cliente', formato: 'csv', titulo: 'T', colunas, fonte: fonte(1) });
    const res = respostaFalsa();
    res.writableFinished = true;
    enviarArquivo(res as unknown as Response, arquivo);
    res.emit('close');
    expect((arquivo.conteudo as Readable).destroyed).toBe(false);
  });

  it('PDF (Buffer) também sai como fluxo', async () => {
    const { servico } = montar();
    const arquivo = await servico.exportar(gestor, { recurso: 'cliente', formato: 'pdf', titulo: 'T', colunas, fonte: fonte(2) });
    expect(Buffer.isBuffer(arquivo.conteudo)).toBe(true);
    const arquivoEnviado = enviarArquivo(respostaFalsa() as unknown as Response, arquivo);
    expect(arquivoEnviado.getStream().readable).toBe(true);
  });
});
