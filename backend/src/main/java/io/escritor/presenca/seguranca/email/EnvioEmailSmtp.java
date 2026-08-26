package io.escritor.presenca.seguranca.email;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EnvioEmailSmtp implements EnvioEmail {

    private final JavaMailSender mailSender;
    private final String remetente;

    public EnvioEmailSmtp(JavaMailSender mailSender, @Value("${app.email.remetente}") String remetente) {
        this.mailSender = mailSender;
        this.remetente = remetente;
    }

    @Override
    public void enviarCodigoAcesso(String destinatario, String codigo) {
        SimpleMailMessage mensagem = new SimpleMailMessage();
        mensagem.setFrom(remetente);
        mensagem.setTo(destinatario);
        mensagem.setSubject("Seu código de acesso");
        mensagem.setText("Seu código de acesso é: " + codigo + "\n\nVálido por 10 minutos.");

        mailSender.send(mensagem);
    }
}
