package io.escritor.presenca.kanban.domain;

public class OrdemColunaDuplicadaException extends RuntimeException {

    public OrdemColunaDuplicadaException(int ordem) {
        super("Já existe uma coluna com a ordem " + ordem + " neste quadro");
    }
}
