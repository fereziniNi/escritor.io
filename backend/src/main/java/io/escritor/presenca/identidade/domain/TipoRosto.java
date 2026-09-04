package io.escritor.presenca.identidade.domain;

/** Personalização de avatar - categoria "Face" (formato do rosto/cabeça), pedida pelo usuário
 * depois da virada pra pixel art real (LPC): "quero poder escolher qual face irei utilizar...
 * quero poder trocar o rosto". Não existe no editor do Gather usado como referência de
 * estrutura - é específica daqui, porque o próprio LPC separa cabeça de corpo em hierarquias
 * diferentes (várias formas de cabeça compatíveis com o mesmo corpo). Usa `corPele` (sem paleta
 * própria) - mesmo padrão de {@link TipoBarba}. */
public enum TipoRosto {
    PADRAO,
    OVAL,
    ENVELHECIDA,
    OVAL_ENVELHECIDA,
    MAGRA,
    ROBUSTA,
    PEQUENA,
    OVAL_PEQUENA
}
