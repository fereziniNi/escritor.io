package io.escritor.presenca.identidade.domain;

/** Personalização de avatar - categoria "Face" (formato do rosto/cabeça), pedida pelo usuário
 * depois da virada pra pixel art real (LPC): "quero poder escolher qual face irei utilizar...
 * quero poder trocar o rosto". Não existe no editor do Gather usado como referência de
 * estrutura - é específica daqui, porque o próprio LPC separa cabeça de corpo em hierarquias
 * diferentes (várias formas de cabeça compatíveis com o mesmo corpo). Usa `corPele` (sem paleta
 * própria) - mesmo padrão de {@link TipoBarba}, mas só nas 15 primeiras opções (as "humanas") - as
 * 7 últimas são criaturas com cor própria (não respondem à cor de pele escolhida, ver
 * `mundo/spriteAvatar.ts#CAMADA_HEAD`).
 *
 * <p>As 7 opções de criatura foram adicionadas depois do usuário reclamar que as 8 opções
 * originais (só variação de formato humano) "trazem poucas diferenças" - o próprio LPC tem uma
 * biblioteca grande de cabeças bem mais distintas entre si (goblin, orc, alienígena etc.), então
 * em vez de forçar diferenciação dentro só do "humano", a expansão foi pra fora dele.
 *
 * <p>Depois disso o usuário pediu especificamente mais rostos HUMANOS ("quero rostos humanos"),
 * não mais criaturas. Como o LPC só tem 10 formatos de cabeça humana no total (já usamos 9 - só
 * "child" fica de fora), as 6 últimas opções (sufixo _MARCANTE/_DELICADO) são cabeças-base
 * compostas com nariz + sobrancelha (overlays do próprio LPC, pré-compostos numa imagem só - ver
 * `mundo/spriteAvatar.ts#CAMADA_HEAD` e `scratchpad/lpc/compor-rostos.py`), não formatos de cabeça
 * novos - o LPC não tem mais desses. */
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
    PADRAO_MARCANTE,
    PADRAO_DELICADO,
    OVAL_MARCANTE,
    OVAL_DELICADO,
    ENVELHECIDA_MARCANTE,
    OVAL_ENVELHECIDA_MARCANTE,
    ALIENIGENA,
    GOBLIN,
    VAMPIRO,
    LOBO,
    COELHO,
    ORC,
    MINOTAURO
}
