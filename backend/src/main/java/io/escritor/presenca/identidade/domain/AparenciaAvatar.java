package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * Personalização do avatar - volta a existir depois de uma passagem por sprites prontos (Kenney,
 * `3538aa2`/`df9f453`/`b5898bf`): o usuário mandou um print do editor de personagem do próprio
 * Gather como referência de UI/categorias (não de sprite a copiar - "nada de arte roubada/baixada
 * do Gather", regra já estabelecida nesta sessão; a arte continua 100% `PIXI.Graphics`/SVG, sem
 * asset de imagem) e pediu "voltar ao sistema desenhado à mão, bem mais detalhado" depois de
 * escolher essa opção entre as alternativas apresentadas. `@Embeddable` (não uma tabela própria) -
 * é uma parte inerente de quem é o usuário, sempre carregada junto, nunca consultada sozinha.
 *
 * <p>As cores (`corPele`/`corCabelo`/`corRoupa`) são validadas contra uma paleta curada em
 * {@link PaletaAparenciaAvatar} - não é um color picker livre. `tipoBarba` é novo nesta volta
 * (espelha a sub-aba "Facial Hair" da referência) - usa `corCabelo`, sem paleta própria.
 */
@Embeddable
public class AparenciaAvatar {

    @Column(name = "cor_pele", nullable = false)
    private String corPele;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_cabelo", nullable = false)
    private EstiloCabelo estiloCabelo;

    @Column(name = "cor_cabelo", nullable = false)
    private String corCabelo;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_roupa", nullable = false)
    private EstiloRoupa estiloRoupa;

    @Column(name = "cor_roupa", nullable = false)
    private String corRoupa;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoOculos oculos;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoChapeu chapeu;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_barba", nullable = false)
    private TipoBarba tipoBarba;

    protected AparenciaAvatar() {
        // JPA
    }

    public AparenciaAvatar(
            String corPele,
            EstiloCabelo estiloCabelo,
            String corCabelo,
            EstiloRoupa estiloRoupa,
            String corRoupa,
            TipoOculos oculos,
            TipoChapeu chapeu,
            TipoBarba tipoBarba) {
        this.corPele = corPele;
        this.estiloCabelo = estiloCabelo;
        this.corCabelo = corCabelo;
        this.estiloRoupa = estiloRoupa;
        this.corRoupa = corRoupa;
        this.oculos = oculos;
        this.chapeu = chapeu;
        this.tipoBarba = tipoBarba;
    }

    /** Aparência de quem ainda não personalizou nada - mesmos valores do `DEFAULT` das colunas em
     * banco (ver `V32__troca_personagem_por_aparencia_detalhada.sql`), então usuários criados
     * antes desta versão já nascem com uma aparência válida sem precisar de backfill manual. */
    public static AparenciaAvatar padrao() {
        return new AparenciaAvatar(
                "#f2c9a0", EstiloCabelo.CURTO, "#4a3728", EstiloRoupa.CAMISETA, "#6b7280", TipoOculos.NENHUM, TipoChapeu.NENHUM, TipoBarba.NENHUM);
    }

    public String getCorPele() {
        return corPele;
    }

    public EstiloCabelo getEstiloCabelo() {
        return estiloCabelo;
    }

    public String getCorCabelo() {
        return corCabelo;
    }

    public EstiloRoupa getEstiloRoupa() {
        return estiloRoupa;
    }

    public String getCorRoupa() {
        return corRoupa;
    }

    public TipoOculos getOculos() {
        return oculos;
    }

    public TipoChapeu getChapeu() {
        return chapeu;
    }

    public TipoBarba getTipoBarba() {
        return tipoBarba;
    }
}
