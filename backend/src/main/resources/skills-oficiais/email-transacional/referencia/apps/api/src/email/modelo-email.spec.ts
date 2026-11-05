// origem: skills-modelo/apps/api/src/email/modelo-email.spec.ts
import { describe, expect, it } from 'vitest';
import { botaoHtml, escaparHtml, montarEmail } from './modelo-email';

describe('montarEmail', () => {
  const { html, texto } = montarEmail(
    'Seu código de acesso',
    `<p>Use o código <strong>123456</strong>.</p>${botaoHtml('Entrar', 'https://app.exemplo.com.br/entrar?t=abc&x=1')}`,
  );

  it('usa a identidade visual com cores em hex inline (clientes de e-mail ignoram CSS vars)', () => {
    expect(html).toContain('#2F6FED');
    expect(html).toContain('#001A33');
    expect(html).not.toMatch(/var\(--/);
    expect(html).not.toMatch(/<style|<script|<link/i);
  });

  it('inclui o título e o corpo no HTML', () => {
    expect(html).toContain('Seu código de acesso');
    expect(html).toContain('<strong>123456</strong>');
    expect(html).toContain('lang="pt-BR"');
  });

  it('a versão texto não tem tags e mantém o conteúdo e o link', () => {
    expect(texto).not.toMatch(/<[^>]+>/);
    expect(texto).toContain('Seu código de acesso');
    expect(texto).toContain('Use o código 123456.');
    expect(texto).toContain('https://app.exemplo.com.br/entrar?t=abc&x=1');
  });

  it('escapa o título (dado do usuário não vira HTML)', () => {
    const m = montarEmail('<img src=x onerror=alert(1)>', '<p>oi</p>');
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;img');
  });

  it('valor de usuário escapado no corpo aparece literal na versão texto (não é tratado como tag)', () => {
    const nome = '<b>Ana</b> & Cia';
    const r = montarEmail('Oi', `<p>Olá, ${escaparHtml(nome)}!</p>`);
    expect(r.html).not.toContain('<b>Ana</b>');
    expect(r.texto).toContain('Olá, <b>Ana</b> & Cia!');
  });

  it('escaparHtml cobre & < > " e apóstrofo', () => {
    expect(escaparHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('botaoHtml recusa URL que não seja http(s)', () => {
    expect(() => botaoHtml('x', 'javascript:alert(1)')).toThrow();
  });
});
