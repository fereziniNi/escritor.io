package io.escritor.presenca.identidade.domain;

/** Personalização de avatar - categoria "Other" do editor do Gather usado como referência de
 * estrutura/quantidade. Simplificação deliberada: só acessórios de peito/pescoço (nunca atrás do
 * corpo, ao contrário de itens como mochila/capa do Gather) - evita precisar de um caso especial
 * de profundidade de camada só por causa de 1-2 itens desta categoria. `NENHUM` não desenha nada. */
public enum EstiloOutro {
    NENHUM,
    BRINCO,
    COLAR,
    LENCO,
    GRAVATA,
    LACO,
    BROCHE,
    MICROFONE
}
