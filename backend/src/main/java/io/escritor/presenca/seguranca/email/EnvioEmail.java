package io.escritor.presenca.seguranca.email;

public interface EnvioEmail {

    void enviarCodigoAcesso(String destinatario, String codigo);
}
