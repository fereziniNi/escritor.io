package io.escritor.presenca.relatorio.service;

import io.escritor.presenca.relatorio.domain.ConfiguracaoRelatorioDiario;
import io.escritor.presenca.relatorio.repository.ConfiguracaoRelatorioDiarioRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import org.springframework.stereotype.Service;

@Service
public class ConfiguracaoRelatorioDiarioService {

    private final ConfiguracaoRelatorioDiarioRepository configuracaoRepository;
    private final Clock clock;

    public ConfiguracaoRelatorioDiarioService(ConfiguracaoRelatorioDiarioRepository configuracaoRepository, Clock clock) {
        this.configuracaoRepository = configuracaoRepository;
        this.clock = clock;
    }

    public ConfiguracaoRelatorioDiario buscar() {
        return configuracaoRepository.findById(ConfiguracaoRelatorioDiario.ID_UNICO).orElse(null);
    }

    /** Cria na primeira vez (nenhum admin configurou ainda) ou atualiza a linha única existente. */
    public ConfiguracaoRelatorioDiario salvar(LocalTime horarioEnvio, boolean habilitado) {
        Instant agora = Instant.now(clock);
        ConfiguracaoRelatorioDiario configuracao = configuracaoRepository
                .findById(ConfiguracaoRelatorioDiario.ID_UNICO)
                .map(existente -> {
                    existente.atualizar(horarioEnvio, habilitado, agora);
                    return existente;
                })
                .orElseGet(() -> new ConfiguracaoRelatorioDiario(horarioEnvio, habilitado, agora));
        return configuracaoRepository.save(configuracao);
    }
}
