package io.escritor.presenca.escritorio.domain;

public class LayoutJsonObrigatorioException extends RuntimeException {

    public LayoutJsonObrigatorioException() {
        super("Layout do mapa (layout_json) é obrigatório");
    }
}
