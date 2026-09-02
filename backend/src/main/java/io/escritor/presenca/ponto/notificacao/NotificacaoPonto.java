package io.escritor.presenca.ponto.notificacao;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.ponto.domain.TipoRegistroPonto;
import java.time.Instant;

/**
 * Pedido do cliente: "gostaria que houvesse uma integração com o evolution api para sempre que
 * algum funcionario iniciasse o trabalho ou terminasse enviar uma mensagem para o chefe
 * avisando". Porta separada da implementação (mesmo padrão de {@code EnvioEmail}/{@code
 * EnvioEmailSmtp} em {@code seguranca.email}) - {@code PontoService} depende só disto, nunca de
 * detalhe de HTTP/Evolution API; trocar de provedor de WhatsApp no futuro não toca em ponto
 * nenhum fora deste pacote.
 */
public interface NotificacaoPonto {

    void avisarPonto(Usuario usuario, TipoRegistroPonto tipo, Instant momento);
}
