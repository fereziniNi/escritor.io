// origem: skills-modelo/apps/api/src/lgpd/chaveiro.spec.ts
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Chaveiro, ErroChaveiro, conferirChavesDistintas, lerChaveIndice, lerChavesDados } from './chaveiro';
import { IndiceCego } from './indice-cego';

const chave = () => randomBytes(32).toString('base64');
const k1 = chave();
const k2 = chave();
const COLUNA = 'cliente.cpf';

describe('lerChavesDados: DADOS_CHAVES="kid1:base64,kid2:base64"', () => {
  it('lê as chaves na ordem; a primeira é a ativa', () => {
    const chaves = lerChavesDados(`k1:${k1}, k2:${k2}`);
    expect(chaves.map((c) => c.kid)).toEqual(['k1', 'k2']);
    expect(chaves[0]!.chave.length).toBe(32);
    expect(new Chaveiro(chaves).kidAtivo).toBe('k1');
  });

  it('recusa chave que não tem 32 bytes depois do base64', () => {
    expect(() => lerChavesDados(`k1:${randomBytes(16).toString('base64')}`)).toThrow(/32 bytes/);
    expect(() => lerChavesDados(`k1:${randomBytes(33).toString('base64')}`)).toThrow(/32 bytes/);
  });

  it('recusa base64 fora do padrão (base64url, espaço no meio, lixo)', () => {
    const url = randomBytes(32).toString('base64url');
    expect(() => lerChavesDados(`k1:${url}`)).toThrow(ErroChaveiro);
    expect(() => lerChavesDados('k1:nao-e-base64!!')).toThrow(ErroChaveiro);
  });

  it('recusa kid repetido, kid inválido, item sem kid e lista vazia', () => {
    expect(() => lerChavesDados(`k1:${k1},k1:${k2}`)).toThrow(/repetid/);
    expect(() => lerChavesDados(`K 1:${k1}`)).toThrow(/kid/);
    expect(() => lerChavesDados(k1)).toThrow(/kid/);
    expect(() => lerChavesDados('')).toThrow(ErroChaveiro);
  });

  it('recusa chave com todos os bytes iguais (chave de brinquedo)', () => {
    expect(() => lerChavesDados(`k1:${Buffer.alloc(32, 7).toString('base64')}`)).toThrow(/bytes iguais/);
  });

  it('a mensagem de erro nunca contém o valor da chave', () => {
    const curta = randomBytes(16).toString('base64');
    try {
      lerChavesDados(`k1:${curta}`);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(curta);
    }
  });
});

describe('chave do índice cego', () => {
  it('32 bytes em base64', () => {
    expect(lerChaveIndice(k1).length).toBe(32);
    expect(() => lerChaveIndice(randomBytes(31).toString('base64'))).toThrow(/32 bytes/);
  });

  it('não pode ser igual a uma das chaves de dados', () => {
    const dados = lerChavesDados(`k1:${k1},k2:${k2}`);
    expect(() => conferirChavesDistintas(dados, lerChaveIndice(k2))).toThrow(/diferente/);
    expect(() => conferirChavesDistintas(dados, lerChaveIndice(chave()))).not.toThrow();
  });
});

describe('Chaveiro: AES-256-GCM, AAD = nome da coluna', () => {
  const chaveiro = new Chaveiro(lerChavesDados(`k1:${k1},k2:${k2}`));

  it('cifrar/decifrar ida e volta', () => {
    const envelope = chaveiro.cifrar('12345678909', COLUNA);
    expect(chaveiro.decifrar(envelope, COLUNA)).toBe('12345678909');
    expect(chaveiro.decifrar(chaveiro.cifrar('Ação é ñ 🙂', COLUNA), COLUNA)).toBe('Ação é ñ 🙂');
  });

  it('formato kid:iv:tag:cifra em base64, IV de 12 bytes e tag de 16; o texto não aparece', () => {
    const envelope = chaveiro.cifrar('12345678909', COLUNA);
    const [kid, iv, tag, cifra, ...resto] = envelope.split(':');
    expect(resto).toEqual([]);
    expect(kid).toBe('k1');
    expect(Buffer.from(iv!, 'base64').length).toBe(12);
    expect(Buffer.from(tag!, 'base64').length).toBe(16);
    expect(Buffer.from(cifra!, 'base64').length).toBe(11);
    expect(envelope).not.toContain('12345678909');
  });

  it('IV aleatório: o mesmo texto cifrado duas vezes dá envelopes diferentes', () => {
    expect(chaveiro.cifrar('12345678909', COLUNA)).not.toBe(chaveiro.cifrar('12345678909', COLUNA));
  });

  it('trocar a AAD (outra coluna) → falha', () => {
    const envelope = chaveiro.cifrar('12345678909', COLUNA);
    expect(() => chaveiro.decifrar(envelope, 'cliente.email')).toThrow(ErroChaveiro);
  });

  it('cifra ou tag adulteradas → falha (GCM autentica)', () => {
    const [kid, iv, tag, cifra] = chaveiro.cifrar('12345678909', COLUNA).split(':') as [string, string, string, string];
    const bytes = Buffer.from(cifra, 'base64');
    bytes[0] = bytes[0]! ^ 1;
    expect(() => chaveiro.decifrar([kid, iv, tag, bytes.toString('base64')].join(':'), COLUNA)).toThrow(ErroChaveiro);
    const tagRuim = Buffer.from(tag, 'base64');
    tagRuim[15] = tagRuim[15]! ^ 1;
    expect(() => chaveiro.decifrar([kid, iv, tagRuim.toString('base64'), cifra].join(':'), COLUNA)).toThrow(ErroChaveiro);
    // tag truncada não é aceita (GCM aceitaria tag curta se ninguém conferisse o tamanho)
    expect(() => chaveiro.decifrar([kid, iv, Buffer.from(tag, 'base64').subarray(0, 4).toString('base64'), cifra].join(':'), COLUNA)).toThrow(ErroChaveiro);
  });

  it('envelope malformado ou de kid desconhecido → falha sem citar o conteúdo', () => {
    expect(() => chaveiro.decifrar('12345678909', COLUNA)).toThrow(ErroChaveiro);
    const alheio = new Chaveiro(lerChavesDados(`k9:${chave()}`)).cifrar('12345678909', COLUNA);
    expect(() => chaveiro.decifrar(alheio, COLUNA)).toThrow(/k9/);
    try {
      chaveiro.decifrar('12345678909', COLUNA);
    } catch (e) {
      expect((e as Error).message).not.toContain('12345678909');
    }
  });

  it('rotação: dado cifrado com kid2 ainda decifra depois que kid1 vira a ativa', () => {
    const antes = new Chaveiro(lerChavesDados(`kid2:${k2}`));
    const envelope = antes.cifrar('12345678909', COLUNA);
    expect(envelope.startsWith('kid2:')).toBe(true);

    const depois = new Chaveiro(lerChavesDados(`kid1:${k1},kid2:${k2}`));
    expect(depois.decifrar(envelope, COLUNA)).toBe('12345678909');
    expect(depois.cifrar('12345678909', COLUNA).startsWith('kid1:')).toBe(true);

    // recifrar: devolve o envelope novo com a chave ativa, ou null se já está nela
    const novo = depois.recifrar(envelope, COLUNA);
    expect(novo?.startsWith('kid1:')).toBe(true);
    expect(depois.decifrar(novo!, COLUNA)).toBe('12345678909');
    expect(depois.recifrar(novo!, COLUNA)).toBeNull();
    expect(depois.kidDe(envelope)).toBe('kid2');
  });

  it('não aceita lista de chaves vazia', () => {
    expect(() => new Chaveiro([])).toThrow(ErroChaveiro);
  });
});

describe('IndiceCego: HMAC-SHA256 com DADOS_CHAVE_INDICE', () => {
  const indice = new IndiceCego(lerChaveIndice(k1));

  it('mesmo CPF → mesmo índice; CPF diferente → índice diferente', () => {
    expect(indice.calcular('12345678909', COLUNA)).toBe(indice.calcular('12345678909', COLUNA));
    expect(indice.calcular('12345678909', COLUNA)).not.toBe(indice.calcular('98765432100', COLUNA));
    expect(indice.calcular('12345678909', COLUNA)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a coluna entra no HMAC: o mesmo valor em outra coluna não casa', () => {
    expect(indice.calcular('12345678909', COLUNA)).not.toBe(indice.calcular('12345678909', 'fornecedor.cpf'));
  });

  it('outra chave → outro índice (sem a chave não dá para montar a tabela de todos os CPFs)', () => {
    expect(new IndiceCego(lerChaveIndice(k2)).calcular('12345678909', COLUNA)).not.toBe(indice.calcular('12345678909', COLUNA));
  });
});
