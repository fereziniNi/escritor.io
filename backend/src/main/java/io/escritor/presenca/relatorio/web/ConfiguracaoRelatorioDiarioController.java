package io.escritor.presenca.relatorio.web;

import io.escritor.presenca.relatorio.service.ConfiguracaoRelatorioDiarioService;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pedido do cliente: "o admin pode escolher a hora do dia para receber um documento sobre o que
 * foi feito no dia pelos funcionarios" - só ADMIN (mesma disciplina de {@code
 * WhatsAppIntegracaoController}: configuração operacional, não dado de trabalho do dia a dia).
 */
@RestController
@RequestMapping("/admin/relatorio-diario")
public class ConfiguracaoRelatorioDiarioController {

    private final ConfiguracaoRelatorioDiarioService configuracaoService;

    public ConfiguracaoRelatorioDiarioController(ConfiguracaoRelatorioDiarioService configuracaoService) {
        this.configuracaoService = configuracaoService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ConfiguracaoRelatorioDiarioResponse buscar() {
        return ConfiguracaoRelatorioDiarioResponse.de(configuracaoService.buscar());
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ConfiguracaoRelatorioDiarioResponse atualizar(@Valid @RequestBody AtualizarConfiguracaoRelatorioDiarioRequest request) {
        return ConfiguracaoRelatorioDiarioResponse.de(
                configuracaoService.salvar(request.horarioEnvio(), request.habilitado(), request.preferencias()));
    }
}
