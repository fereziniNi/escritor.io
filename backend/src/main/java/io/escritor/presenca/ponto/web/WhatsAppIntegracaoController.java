package io.escritor.presenca.ponto.web;

import io.escritor.presenca.ponto.notificacao.EvolutionInstanceService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do cliente: "o codigo QR code poderia ficar na plataforma que voce programou??" - só
 * ADMIN (mesma disciplina de `UsuarioController#listar`: configuração operacional, não dado de
 * trabalho do dia a dia). O frontend chama isto em loop curto (poucos segundos) enquanto a tela
 * de integração está aberta, pra saber quando o QR code foi escaneado sem precisar de um clique
 * manual de "atualizar".
 */
@RestController
@RequestMapping("/admin/whatsapp")
public class WhatsAppIntegracaoController {

    private final EvolutionInstanceService evolutionInstanceService;

    public WhatsAppIntegracaoController(EvolutionInstanceService evolutionInstanceService) {
        this.evolutionInstanceService = evolutionInstanceService;
    }

    @GetMapping("/estado")
    @PreAuthorize("hasRole('ADMIN')")
    public EstadoWhatsAppResponse estado() {
        return EstadoWhatsAppResponse.de(evolutionInstanceService.buscarEstado());
    }
}
