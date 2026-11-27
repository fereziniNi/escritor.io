// origem: skills-modelo/apps/api/src/armazenamento/config-armazenamento.spec.ts
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';

const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://dono:senha-do-dono@localhost:5432/app',
  ...extra,
});

const SEGREDO = 'a'.repeat(32);

describe('configuração do armazenamento', () => {
  it('padrão: local, 10 MB, links de 5 minutos, antivírus desligado', () => {
    const c = carregarConfig(base());
    expect(c.ARMAZENAMENTO_TIPO).toBe('local');
    expect(c.UPLOAD_MAX_MB).toBe(10);
    expect(c.UPLOAD_LIMITE_POR_MIN).toBe(20);
    expect(c.URL_ASSINADA_SEGUNDOS).toBe(300);
    expect(c.ANTIVIRUS_HABILITADO).toBe(false);
    expect(c.CLAMAV_PORTA).toBe(3310);
  });

  it('UPLOAD_MAX_MB: inteiro de 1 a 500', () => {
    expect(carregarConfig(base({ UPLOAD_MAX_MB: '25' })).UPLOAD_MAX_MB).toBe(25);
    for (const ruim of ['0', '-1', '1.5', '501', 'abc']) {
      expect(() => carregarConfig(base({ UPLOAD_MAX_MB: ruim }))).toThrow(/UPLOAD_MAX_MB/);
    }
  });

  it('URL_ASSINADA_SEGUNDOS: de 10 a 3600 (link curto)', () => {
    for (const ruim of ['5', '3601', 'x']) {
      expect(() => carregarConfig(base({ URL_ASSINADA_SEGUNDOS: ruim }))).toThrow(/URL_ASSINADA_SEGUNDOS/);
    }
  });

  it('ARMAZENAMENTO_TIPO desconhecido é recusado', () => {
    expect(() => carregarConfig(base({ ARMAZENAMENTO_TIPO: 'ftp' }))).toThrow(/ARMAZENAMENTO_TIPO/);
  });

  it('s3 exige bucket e chaves, juntas; os segredos não aparecem no erro', () => {
    expect(() => carregarConfig(base({ ARMAZENAMENTO_TIPO: 's3' }))).toThrow(/S3_BUCKET/);
    expect(() => carregarConfig(base({ ARMAZENAMENTO_TIPO: 's3', S3_BUCKET: 'bucket-teste', S3_ACCESS_KEY: 'ak' }))).toThrow(/S3_SECRET_KEY/);
    const c = carregarConfig(base({ ARMAZENAMENTO_TIPO: 's3', S3_BUCKET: 'bucket-teste', S3_ACCESS_KEY: 'ak', S3_SECRET_KEY: 'sk-secreta' }));
    expect(c.S3_REGION).toBe('us-east-1');
    expect(JSON.stringify(c.S3_SECRET_KEY)).not.toContain('sk-secreta');
    try {
      carregarConfig(base({ ARMAZENAMENTO_TIPO: 's3', S3_BUCKET: 'bucket-teste', S3_ACCESS_KEY: 'ak-vazou' }));
    } catch (e) {
      expect((e as Error).message).not.toContain('ak-vazou');
    }
  });

  it('azure exige a connection string e o container', () => {
    expect(() => carregarConfig(base({ ARMAZENAMENTO_TIPO: 'azure' }))).toThrow(/AZURE_CONNECTION_STRING/);
    expect(() => carregarConfig(base({ ARMAZENAMENTO_TIPO: 'azure', AZURE_CONNECTION_STRING: 'UseDevelopmentStorage=true' }))).toThrow(/AZURE_CONTAINER/);
    const c = carregarConfig(base({ ARMAZENAMENTO_TIPO: 'azure', AZURE_CONNECTION_STRING: 'UseDevelopmentStorage=true', AZURE_CONTAINER: 'arquivos' }));
    expect(c.AZURE_CONTAINER).toBe('arquivos');
  });

  it('ARMAZENAMENTO_SEGREDO_URL: Segredo de no mínimo 32 caracteres', () => {
    expect(() => carregarConfig(base({ ARMAZENAMENTO_SEGREDO_URL: 'curto' }))).toThrow(/ARMAZENAMENTO_SEGREDO_URL/);
    const c = carregarConfig(base({ ARMAZENAMENTO_SEGREDO_URL: SEGREDO }));
    expect(JSON.stringify(c.ARMAZENAMENTO_SEGREDO_URL)).not.toContain(SEGREDO);
  });

  it('antivírus: porta e host do ClamAV válidos', () => {
    const c = carregarConfig(base({ ANTIVIRUS_HABILITADO: 'true', CLAMAV_HOST: 'clamav', CLAMAV_PORTA: '3311' }));
    expect(c.ANTIVIRUS_HABILITADO).toBe(true);
    expect(c.CLAMAV_PORTA).toBe(3311);
    expect(() => carregarConfig(base({ ANTIVIRUS_HABILITADO: 'sim' }))).toThrow(/ANTIVIRUS_HABILITADO/);
    expect(() => carregarConfig(base({ CLAMAV_PORTA: '0' }))).toThrow(/CLAMAV_PORTA/);
  });
});
