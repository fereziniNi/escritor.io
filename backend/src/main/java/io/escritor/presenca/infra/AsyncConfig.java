package io.escritor.presenca.infra;

import java.util.concurrent.Executor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Pool dedicado pra tarefas assíncronas de "melhor esforço" - hoje só {@code
 * NotificacaoPontoWhatsApp}, avisando o chefe quando alguém bate ponto (pedido do cliente:
 * "integração com o evolution api pra... enviar uma mensagem para o chefe avisando"). Nunca deve
 * competir com nem bloquear requisições HTTP normais - por isso um executor próprio, não o
 * `SimpleAsyncExecutor` padrão do Spring (thread-por-tarefa, sem limite). Tamanho pequeno de
 * propósito: são chamadas rápidas pra uma API externa, não processamento pesado.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "notificacaoExecutor")
    public Executor notificacaoExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("notificacao-");
        executor.initialize();
        return executor;
    }
}
