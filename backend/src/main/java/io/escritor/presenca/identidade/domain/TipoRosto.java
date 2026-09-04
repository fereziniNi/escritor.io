package io.escritor.presenca.identidade.domain;

/** Personalização de avatar - categoria "Face" (formato do rosto/cabeça), pedida pelo usuário
 * depois da virada pra pixel art real (LPC): "quero poder escolher qual face irei utilizar...
 * quero poder trocar o rosto". Não existe no editor do Gather usado como referência de
 * estrutura - é específica daqui, porque o próprio LPC separa cabeça de corpo em hierarquias
 * diferentes (várias formas de cabeça compatíveis com o mesmo corpo). Usa `corPele` (sem paleta
 * própria) - mesmo padrão de {@link TipoBarba}, mas só nas 9 primeiras opções (as "humanas") - as
 * 7 seguintes são criaturas com cor própria (não respondem à cor de pele escolhida, ver
 * `mundo/spriteAvatar.ts#CAMADA_HEAD`).
 *
 * <p>As 7 opções de criatura foram adicionadas depois do usuário reclamar que as 8 opções
 * originais (só variação de formato humano) "trazem poucas diferenças" - o próprio LPC tem uma
 * biblioteca grande de cabeças bem mais distintas entre si (goblin, orc, alienígena etc.), então
 * em vez de forçar diferenciação dentro só do "humano", a expansão foi pra fora dele. */
public enum TipoRosto {
    PADRAO,
    OVAL,
    ENVELHECIDA,
    OVAL_ENVELHECIDA,
    MAGRA,
    ROBUSTA,
    PEQUENA,
    OVAL_PEQUENA,
    IDOSA_PEQUENA,
    ALIENIGENA,
    GOBLIN,
    VAMPIRO,
    LOBO,
    COELHO,
    ORC,
    MINOTAURO
}
