import { describe, expect, it } from 'vitest';
import { ErroConfiguracao, carregarConfig } from '../config/config';
import { origemCorsPermitida } from './cors';

const env = (extra: Record<string, string>) => ({ DATABASE_URL: 'postgres://app:x@localhost:5432/app', ...extra });

describe('variáveis de segurança na configuração', () => {
  it('padrões: CORS desligado, 300 requisições por minuto por IP, nenhum proxy confiável', () => {
    const config = carregarConfig(env({}));
    expect(config.CORS_ORIGENS).toEqual([]);
    expect(config.LIMITE_REQ_POR_IP).toBe(300);
    expect(config.PROXIES_CONFIAVEIS).toBe(0);
  });

  it('CORS_ORIGENS aceita lista separada por vírgula de origens https (http só para localhost e 127.0.0.1)', () => {
    const config = carregarConfig(env({ CORS_ORIGENS: 'https://painel.exemplo.com.br, http://localhost:5173,http://127.0.0.1:8080' }));
    expect(config.CORS_ORIGENS).toEqual(['https://painel.exemplo.com.br', 'http://localhost:5173', 'http://127.0.0.1:8080']);
  });

  it('CORS_ORIGENS com caminho, curinga, sem esquema ou http fora de localhost é recusado no boot', () => {
    for (const valor of ['https://painel.exemplo.com.br/app', '*', 'painel.exemplo.com.br', 'https://*.exemplo.com.br', 'http://painel.exemplo.com.br', 'http://localhost.exemplo.com.br']) {
      expect(() => carregarConfig(env({ CORS_ORIGENS: valor }))).toThrow(ErroConfiguracao);
      expect(() => carregarConfig(env({ CORS_ORIGENS: valor }))).toThrow(/CORS_ORIGENS/);
    }
  });

  it('LIMITE_REQ_POR_IP e PROXIES_CONFIAVEIS precisam ser inteiros válidos', () => {
    expect(() => carregarConfig(env({ LIMITE_REQ_POR_IP: '0' }))).toThrow(/LIMITE_REQ_POR_IP/);
    expect(() => carregarConfig(env({ PROXIES_CONFIAVEIS: '-1' }))).toThrow(/PROXIES_CONFIAVEIS/);
  });
});

describe('origemCorsPermitida', () => {
  it('só origens da lista, comparação exata; nunca lança', () => {
    const lista = ['https://painel.exemplo.com.br'];
    expect(origemCorsPermitida('https://painel.exemplo.com.br', lista)).toBe(true);
    expect(origemCorsPermitida('https://PAINEL.exemplo.com.br.malicioso.exemplo', lista)).toBe(false);
    expect(origemCorsPermitida('https://malicioso.exemplo', lista)).toBe(false);
    expect(origemCorsPermitida(undefined, lista)).toBe(false);
    expect(origemCorsPermitida('null', lista)).toBe(false);
  });
});
