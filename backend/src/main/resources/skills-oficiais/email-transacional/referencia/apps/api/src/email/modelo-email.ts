// origem: skills-modelo/apps/api/src/email/modelo-email.ts
/**
 * Modelo de e-mail com a identidade visual Multiplica. Clientes de e-mail ignoram CSS externo, `<style>` e variáveis
 * CSS, então os valores abaixo são os tokens de `apps/web/src/tema/tokens.css` (tema claro) copiados em hex e aplicados
 * em `style` inline. Se a identidade mudar, mude aqui também. Layout em tabela (Outlook), 600 px, sem imagem externa.
 */
export const COR = {
  primaria: '#2F6FED',
  sobrePrimaria: '#FFFFFF',
  navy: '#001A33',
  navyTexto: '#C2CEDD',
  fundo: '#F5F7FA',
  superficie: '#FFFFFF',
  borda: '#DEE6EF',
  texto: '#172B43',
  texto2: '#5B6B80',
  texto3: '#8A97A8',
} as const;

const FONTE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapa texto que vira HTML. Todo dado de usuário (nome, título) passa por aqui antes de entrar em `corpoHtml`. */
export function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Botão de chamada para ação (link). Só http(s): `javascript:` e afins são recusados. */
export function botaoHtml(rotulo: string, url: string): string {
  if (!/^https?:\/\//i.test(url)) throw new Error('botaoHtml: a URL deve começar com http:// ou https://');
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>` +
    `<td style="background:${COR.primaria};border-radius:6px;">` +
    `<a href="${escaparHtml(url)}" style="display:inline-block;padding:12px 24px;font-family:${FONTE};font-size:16px;font-weight:600;color:${COR.sobrePrimaria};text-decoration:none;">${escaparHtml(rotulo)}</a>` +
    `</td></tr></table>`
  );
}

export interface OpcoesModelo {
  /** Nome no topo da mensagem. */
  nomeSistema?: string;
  rodape?: string;
}

const ENTIDADES: Record<string, string> = { '&nbsp;': ' ', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' };

/** HTML do corpo -> texto puro: links viram `rótulo (url)`, blocos viram linhas, tags somem, entidades voltam a caracteres. */
function htmlParaTexto(html: string): string {
  return html
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_t, url: string, rotulo: string) => `${rotulo.replace(/<[^>]*>/g, '')} (${url})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|table)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|lt|gt|quot|#39|amp);/g, (e) => ENTIDADES[e] ?? e)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Monta o e-mail padrão: faixa navy com o nome do sistema, cartão branco com o título e o corpo, rodapé discreto.
 * `titulo` é texto puro (é escapado aqui); `corpoHtml` é HTML já montado por você (escape dados de usuário com
 * `escaparHtml`, use `botaoHtml` para links). Devolve as duas versões, que vão juntas em `MensagemEmail`.
 */
export function montarEmail(titulo: string, corpoHtml: string, opcoes: OpcoesModelo = {}): { html: string; texto: string } {
  const { nomeSistema = 'Multiplica', rodape = 'Mensagem automática. Não responda a este e-mail.' } = opcoes;
  const t = escaparHtml(titulo);
  const html =
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title></head>` +
    `<body style="margin:0;padding:0;background:${COR.fundo};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};"><tr><td align="center" style="padding:24px 12px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">` +
    `<tr><td style="background:${COR.navy};padding:20px 24px;border-top:4px solid ${COR.primaria};border-radius:8px 8px 0 0;font-family:${FONTE};font-size:18px;font-weight:700;color:${COR.sobrePrimaria};">${escaparHtml(nomeSistema)}</td></tr>` +
    `<tr><td style="background:${COR.superficie};padding:32px 24px;border:1px solid ${COR.borda};border-top:0;font-family:${FONTE};font-size:16px;line-height:1.5;color:${COR.texto};">` +
    `<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COR.texto};">${t}</h1>${corpoHtml}</td></tr>` +
    `<tr><td style="padding:16px 24px;font-family:${FONTE};font-size:12px;line-height:1.5;color:${COR.texto3};">${escaparHtml(rodape)}</td></tr>` +
    `</table></td></tr></table></body></html>`;
  const texto = `${titulo}\n\n${htmlParaTexto(corpoHtml)}\n\n--\n${rodape}`;
  return { html, texto };
}
