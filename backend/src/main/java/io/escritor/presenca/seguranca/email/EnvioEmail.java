package io.escritor.presenca.seguranca.email;

public interface EnvioEmail {

    void enviarCodigoAcesso(String destinatario, String codigo);

    /**
     * Auditoria de segurança (VULN-10, LOW): trocar o próprio e-mail (`PATCH /usuarios/me/perfil`)
     * não pedia nenhuma reconfirmação - baixo risco de verdade hoje (a checagem de e-mail único
     * contra usuários ativos já barra a maioria dos casos úteis pra um invasor), mas era o único
     * campo sensível do sistema que não passava por nenhum código de verificação, diferente de
     * tudo em {@code identidade.service.AutenticacaoService}. Implementar reconfirmação de
     * verdade (código enviado pro e-mail NOVO antes da troca valer) seria uma funcionalidade nova
     * de fluxo em duas etapas, não uma correção pontual - desproporcional pra um achado LOW.
     * Alternativa mais barata e ainda real: avisar o e-mail ANTIGO sempre que a troca acontecer
     * (best-effort, nunca bloqueia a troca em si) - quem não pediu a mudança tem como perceber e
     * agir (ex.: falar com o ADMIN) quase na hora, em vez de nunca saber.
     */
    void avisarTrocaDeEmail(String destinatarioAntigo, String novoEmail);
}
