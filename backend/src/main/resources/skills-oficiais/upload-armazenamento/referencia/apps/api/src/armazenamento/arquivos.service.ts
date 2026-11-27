// origem: skills-modelo/apps/api/src/armazenamento/arquivos.service.ts
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { type Readable } from 'node:stream';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { BANCO, type Db } from '../banco/banco';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { exigirPapel, type UsuarioAtual } from '../usuarios/usuario-atual';
import { ANTIVIRUS, type Antivirus } from './antivirus';
import { ARMAZENAMENTO, type Armazenamento } from './armazenamento';
import { ArmazenamentoLocal } from './armazenamento-local';
import { arquivo, type Escopo } from './arquivo.tabela';
import { exigirChaveValida, gerarChave } from './chave';
import { LimiteExcedido, lerCabecalho, limitarTamanho } from './limitar-tamanho';
import { nomeParaExibir } from './nome-arquivo';
import { BYTES_DO_CABECALHO, validarTipo } from './tipos';

/** O que a API devolve de um arquivo: nunca a `chave` (nome do objeto no armazenamento). */
export interface ArquivoPublico {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  escopo: Escopo;
  donoId: string;
  varredura: 'LIMPO' | 'NAO_VARRIDO';
  criadoEm: string;
}

export interface ArquivoParaBaixar {
  stream: Readable;
  nome: string;
  tipo: string;
  tamanho: number;
}

type Linha = typeof arquivo.$inferSelect;

const publico = (l: Linha): ArquivoPublico => ({
  id: l.id,
  nome: l.nomeOriginal,
  tipo: l.tipo,
  tamanho: l.tamanho,
  escopo: l.escopo as Escopo,
  donoId: l.donoId,
  varredura: l.varredura as ArquivoPublico['varredura'],
  criadoEm: l.criadoEm.toISOString(),
});

/** Ver e baixar: o dono, todo ADMIN, e todo GESTOR quando o escopo é GESTAO. É a ÚNICA regra de visibilidade (lista e acesso). */
export function podeVer(eu: UsuarioAtual, a: Pick<Linha, 'donoId' | 'escopo'>): boolean {
  if (a.donoId === eu.id || eu.papel === 'ADMIN') return true;
  return eu.papel === 'GESTOR' && a.escopo === 'GESTAO';
}

/** Remover: só o dono ou um ADMIN (GESTOR vê o arquivo da gestão, mas não apaga o dos outros). */
export const podeRemover = (eu: UsuarioAtual, a: Pick<Linha, 'donoId'>): boolean => a.donoId === eu.id || eu.papel === 'ADMIN';

const PAPEIS_COM_ARQUIVOS = ['ADMIN', 'GESTOR', 'USUARIO'] as const;

/**
 * Regras de negócio dos arquivos. Toda rota passa por aqui, e AQUI se confere o papel e o dono (a rota tem `@Papeis`, mas o
 * serviço não confia nela). Pedir um arquivo que não pode ver dá 404, igual a um que não existe: não revela o que há.
 * Ordem do upload: tipo pelo conteúdo (415) → grava com limite de tamanho (413) → varredura se ligada (422/503) → só então
 * a linha de metadados e o evento de auditoria numa transação. Sem a linha, o objeto é inalcançável (é a "quarentena").
 */
@Injectable()
export class ArquivosService {
  private readonly log = new Logger(ArquivosService.name);

  constructor(
    @Inject(BANCO) private readonly db: Db,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(ARMAZENAMENTO) private readonly armazenamento: Armazenamento,
    @Inject(ANTIVIRUS) private readonly antivirus: Antivirus | null,
    private readonly auditoria: AuditoriaService,
  ) {}

  get limiteBytes(): number {
    return this.config.UPLOAD_MAX_MB * 1024 * 1024;
  }

  async enviar(eu: UsuarioAtual | undefined, entrada: { stream: Readable; nomeDoCliente: string; escopo: Escopo }): Promise<ArquivoPublico> {
    exigirPapel(eu, ...PAPEIS_COM_ARQUIVOS);
    const medida = { bytes: 0 };
    const limitado = limitarTamanho(entrada.stream, this.limiteBytes, medida);
    let cabecalho: Buffer;
    let resto: Readable;
    try {
      ({ cabecalho, resto } = await lerCabecalho(limitado, BYTES_DO_CABECALHO));
    } catch (e) {
      throw this.traduzir(e);
    }
    // O tipo vem dos bytes, nunca do nome nem do Content-Type que o cliente declarou.
    const tipo = validarTipo(cabecalho);
    if (!tipo) {
      resto.destroy();
      throw new UnsupportedMediaTypeException('Tipo de arquivo não permitido (aceitos: PDF, PNG, JPEG e XLSX)');
    }
    const chave = gerarChave(tipo.extensao);
    try {
      await this.armazenamento.salvar(chave, resto, tipo.mime);
    } catch (e) {
      await this.descartar(chave);
      throw this.traduzir(e);
    }
    if (medida.bytes === 0) {
      await this.descartar(chave);
      throw new UnsupportedMediaTypeException('Arquivo vazio');
    }

    if (this.antivirus) await this.varrer(eu, chave, entrada.nomeDoCliente, tipo.extensao, medida.bytes);

    const nome = nomeParaExibir(entrada.nomeDoCliente, tipo.extensao);
    try {
      return await this.db.transaction(async (tx) => {
        const [linha] = await tx
          .insert(arquivo)
          .values({ chave, nomeOriginal: nome, tipo: tipo.mime, tamanho: medida.bytes, donoId: eu.id, escopo: entrada.escopo, varredura: this.antivirus ? 'LIMPO' : 'NAO_VARRIDO' })
          .returning();
        await this.auditoria.registrar(
          {
            acao: 'arquivo.enviar',
            atorId: eu.id,
            alvoTipo: 'arquivo',
            alvoId: linha!.id,
            depois: { nome, tipo: tipo.mime, tamanho: medida.bytes, escopo: entrada.escopo, varredura: linha!.varredura },
          },
          tx,
        );
        return publico(linha!);
      });
    } catch (e) {
      await this.descartar(chave);
      throw e;
    }
  }

  async listar(eu: UsuarioAtual | undefined): Promise<ArquivoPublico[]> {
    exigirPapel(eu, ...PAPEIS_COM_ARQUIVOS);
    const visivel = eu.papel === 'ADMIN' ? undefined : eu.papel === 'GESTOR' ? or(eq(arquivo.donoId, eu.id), eq(arquivo.escopo, 'GESTAO')) : eq(arquivo.donoId, eu.id);
    const linhas = await this.db
      .select()
      .from(arquivo)
      .where(and(isNull(arquivo.removidoEm), visivel))
      .orderBy(desc(arquivo.criadoEm), desc(arquivo.id))
      .limit(200);
    return linhas.map(publico);
  }

  /** Download pela API (sessão). A auditoria é gravada ANTES do primeiro byte: se a trilha falhar, nada é enviado. */
  async baixar(eu: UsuarioAtual | undefined, id: string): Promise<ArquivoParaBaixar> {
    const linha = await this.obterVisivel(eu, id);
    await this.auditoria.registrar({ acao: 'arquivo.baixar', atorId: eu!.id, alvoTipo: 'arquivo', alvoId: id, depois: { nome: linha.nomeOriginal, via: 'api' } });
    return this.abrir(linha);
  }

  /** Link temporário de download. Em S3/Azure o navegador baixa direto do provedor (por isso a auditoria é do link, não do byte). */
  async linkAssinado(eu: UsuarioAtual | undefined, id: string): Promise<{ url: string; expiraEm: string }> {
    const linha = await this.obterVisivel(eu, id);
    const segundos = this.config.URL_ASSINADA_SEGUNDOS;
    await this.auditoria.registrar({ acao: 'arquivo.baixar', atorId: eu!.id, alvoTipo: 'arquivo', alvoId: id, depois: { nome: linha.nomeOriginal, via: 'link', validadeSegundos: segundos } });
    const url = await this.armazenamento.urlAssinada(linha.chave, segundos, { nomeDownload: linha.nomeOriginal, tipo: linha.tipo });
    return { url, expiraEm: new Date(Date.now() + segundos * 1000).toISOString() };
  }

  /** Download pelo link assinado do armazenamento local (sem sessão: quem vale é a assinatura HMAC com expiração). */
  async baixarPorLinkLocal(chave: string, exp: string | null, sig: string | null): Promise<ArquivoParaBaixar> {
    if (!(this.armazenamento instanceof ArmazenamentoLocal)) throw new NotFoundException();
    try {
      exigirChaveValida(chave);
    } catch {
      throw new ForbiddenException('Link inválido ou expirado');
    }
    if (!this.armazenamento.verificarLink(chave, exp, sig)) throw new ForbiddenException('Link inválido ou expirado');
    const [linha] = await this.db.select().from(arquivo).where(and(eq(arquivo.chave, chave), isNull(arquivo.removidoEm))).limit(1);
    if (!linha) throw new NotFoundException();
    await this.auditoria.registrar({ acao: 'arquivo.baixar', atorId: null, alvoTipo: 'arquivo', alvoId: linha.id, depois: { nome: linha.nomeOriginal, via: 'link_local' } });
    return this.abrir(linha);
  }

  async remover(eu: UsuarioAtual | undefined, id: string): Promise<void> {
    const linha = await this.obterVisivel(eu, id);
    if (!podeRemover(eu!, linha)) throw new ForbiddenException();
    await this.db.transaction(async (tx) => {
      await tx.update(arquivo).set({ removidoEm: new Date() }).where(eq(arquivo.id, id));
      await this.auditoria.registrar({ acao: 'arquivo.remover', atorId: eu!.id, alvoTipo: 'arquivo', alvoId: id, antes: { nome: linha.nomeOriginal, escopo: linha.escopo } }, tx);
    });
    await this.descartar(linha.chave);
  }

  /** Arquivo que existe, não foi removido e o usuário pode ver; senão 404 (não revela se existe). */
  private async obterVisivel(eu: UsuarioAtual | undefined, id: string): Promise<Linha> {
    exigirPapel(eu, ...PAPEIS_COM_ARQUIVOS);
    const [linha] = await this.db.select().from(arquivo).where(and(eq(arquivo.id, id), isNull(arquivo.removidoEm))).limit(1);
    if (!linha || !podeVer(eu, linha)) throw new NotFoundException();
    return linha;
  }

  private async abrir(linha: Linha): Promise<ArquivoParaBaixar> {
    try {
      return { stream: await this.armazenamento.abrir(linha.chave), nome: linha.nomeOriginal, tipo: linha.tipo, tamanho: linha.tamanho };
    } catch (e) {
      this.log.error({ err: e, arquivoId: linha.id }, 'objeto do arquivo não abriu no armazenamento');
      throw new NotFoundException();
    }
  }

  /** Varredura do ClamAV sobre o objeto já gravado (sem linha no banco ele ainda é inalcançável). Falha fechada. */
  private async varrer(eu: UsuarioAtual, chave: string, nomeDoCliente: string, extensao: 'pdf' | 'png' | 'jpg' | 'xlsx', tamanho: number): Promise<void> {
    let resultado;
    try {
      resultado = await this.antivirus!.verificar(await this.armazenamento.abrir(chave));
    } catch (e) {
      await this.descartar(chave);
      this.log.error({ err: e }, 'antivírus indisponível: upload recusado (falha fechada)');
      throw new ServiceUnavailableException('Não foi possível verificar o arquivo agora; tente de novo em instantes');
    }
    if (resultado.limpo) return;
    await this.descartar(chave);
    await this.auditoria.registrar({
      acao: 'arquivo.bloquear',
      atorId: eu.id,
      alvoTipo: 'arquivo',
      depois: { motivo: 'antivirus', ameaca: resultado.ameaca, nome: nomeParaExibir(nomeDoCliente, extensao), tamanho },
    });
    throw new UnprocessableEntityException('O arquivo foi bloqueado: o antivírus detectou uma ameaça');
  }

  /** Apaga o objeto sem deixar o erro mascarar o que realmente aconteceu; sobra de objeto vai para o log. */
  private async descartar(chave: string): Promise<void> {
    try {
      await this.armazenamento.remover(chave);
    } catch (e) {
      this.log.error({ err: e }, 'não consegui apagar um objeto do armazenamento (órfão a limpar)');
    }
  }

  private traduzir(e: unknown): unknown {
    if (e instanceof LimiteExcedido) return new PayloadTooLargeException(`Arquivo maior que ${this.config.UPLOAD_MAX_MB} MB`);
    return e;
  }
}
