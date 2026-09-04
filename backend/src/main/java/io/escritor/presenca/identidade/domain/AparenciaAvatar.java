package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * Personalização do avatar - estrutura e quantidade de categorias espelham o editor de personagem
 * do Gather (mandado como referência pelo usuário: "faça exatamente igual... todas as opções de
 * partes devem possuir mais do que a tela esta mostrando"), mas a arte é 100% original ("nada de
 * arte roubada/baixada do Gather", regra já estabelecida nesta sessão). A arte virou pixel art
 * real (LPC) numa virada posterior - ver `frontend/.../mundo/spriteAvatar.ts`. 11 categorias
 * (Skin/Face/Hair/Facial hair/Top/Jacket/Bottom/Shoes/Hat/Glasses/Other), cada uma com ~8-11
 * opções - bem mais do que a v1 (`ea212ee`, 4 categorias com 3-4 opções cada). "Face" (formato do
 * rosto/cabeça) não existe no Gather - específica daqui, porque o LPC separa cabeça de corpo.
 *
 * <p>As cores são validadas contra {@link PaletaAparenciaAvatar} - `corPele`/`corCabelo` têm
 * paleta própria, as demais 7 categorias (Top/Jacket/Bottom/Shoes/Hat/Glasses/Other) compartilham
 * uma paleta geral única (mesmo padrão visto nos prints do Gather - a mesma fileira de cor se
 * repete em quase toda categoria). `tipoBarba` usa `corCabelo` (sem paleta própria).
 */
@Embeddable
public class AparenciaAvatar {

    @Column(name = "cor_pele", nullable = false)
    private String corPele;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_rosto", nullable = false)
    private TipoRosto tipoRosto;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_cabelo", nullable = false)
    private EstiloCabelo estiloCabelo;

    @Column(name = "cor_cabelo", nullable = false)
    private String corCabelo;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_barba", nullable = false)
    private TipoBarba tipoBarba;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_top", nullable = false)
    private EstiloTop estiloTop;

    @Column(name = "cor_top", nullable = false)
    private String corTop;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_jaqueta", nullable = false)
    private EstiloJaqueta estiloJaqueta;

    @Column(name = "cor_jaqueta", nullable = false)
    private String corJaqueta;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_bottom", nullable = false)
    private EstiloBottom estiloBottom;

    @Column(name = "cor_bottom", nullable = false)
    private String corBottom;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_sapato", nullable = false)
    private EstiloSapato estiloSapato;

    @Column(name = "cor_sapato", nullable = false)
    private String corSapato;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoChapeu chapeu;

    @Column(name = "cor_chapeu", nullable = false)
    private String corChapeu;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoOculos oculos;

    @Column(name = "cor_oculos", nullable = false)
    private String corOculos;

    @Enumerated(EnumType.STRING)
    @Column(name = "estilo_outro", nullable = false)
    private EstiloOutro estiloOutro;

    @Column(name = "cor_outro", nullable = false)
    private String corOutro;

    protected AparenciaAvatar() {
        // JPA
    }

    public AparenciaAvatar(
            String corPele,
            TipoRosto tipoRosto,
            EstiloCabelo estiloCabelo,
            String corCabelo,
            TipoBarba tipoBarba,
            EstiloTop estiloTop,
            String corTop,
            EstiloJaqueta estiloJaqueta,
            String corJaqueta,
            EstiloBottom estiloBottom,
            String corBottom,
            EstiloSapato estiloSapato,
            String corSapato,
            TipoChapeu chapeu,
            String corChapeu,
            TipoOculos oculos,
            String corOculos,
            EstiloOutro estiloOutro,
            String corOutro) {
        this.corPele = corPele;
        this.tipoRosto = tipoRosto;
        this.estiloCabelo = estiloCabelo;
        this.corCabelo = corCabelo;
        this.tipoBarba = tipoBarba;
        this.estiloTop = estiloTop;
        this.corTop = corTop;
        this.estiloJaqueta = estiloJaqueta;
        this.corJaqueta = corJaqueta;
        this.estiloBottom = estiloBottom;
        this.corBottom = corBottom;
        this.estiloSapato = estiloSapato;
        this.corSapato = corSapato;
        this.chapeu = chapeu;
        this.corChapeu = corChapeu;
        this.oculos = oculos;
        this.corOculos = corOculos;
        this.estiloOutro = estiloOutro;
        this.corOutro = corOutro;
    }

    /** Aparência de quem ainda não personalizou nada - mesmos valores do `DEFAULT` das colunas em
     * banco (ver `V34__adiciona_tipo_rosto.sql`), então usuários criados antes desta versão já
     * nascem com uma aparência válida sem precisar de backfill manual. */
    public static AparenciaAvatar padrao() {
        return new AparenciaAvatar(
                "#f2c9a0",
                TipoRosto.PADRAO,
                EstiloCabelo.CURTO,
                "#4a3728",
                TipoBarba.NENHUM,
                EstiloTop.CAMISETA,
                "#6b7280",
                EstiloJaqueta.NENHUMA,
                "#6b7280",
                EstiloBottom.CALCA,
                "#2b2b3a",
                EstiloSapato.TENIS,
                "#1c1a28",
                TipoChapeu.NENHUM,
                "#6b7280",
                TipoOculos.NENHUM,
                "#6b7280",
                EstiloOutro.NENHUM,
                "#6b7280");
    }

    public String getCorPele() {
        return corPele;
    }

    public TipoRosto getTipoRosto() {
        return tipoRosto;
    }

    public EstiloCabelo getEstiloCabelo() {
        return estiloCabelo;
    }

    public String getCorCabelo() {
        return corCabelo;
    }

    public TipoBarba getTipoBarba() {
        return tipoBarba;
    }

    public EstiloTop getEstiloTop() {
        return estiloTop;
    }

    public String getCorTop() {
        return corTop;
    }

    public EstiloJaqueta getEstiloJaqueta() {
        return estiloJaqueta;
    }

    public String getCorJaqueta() {
        return corJaqueta;
    }

    public EstiloBottom getEstiloBottom() {
        return estiloBottom;
    }

    public String getCorBottom() {
        return corBottom;
    }

    public EstiloSapato getEstiloSapato() {
        return estiloSapato;
    }

    public String getCorSapato() {
        return corSapato;
    }

    public TipoChapeu getChapeu() {
        return chapeu;
    }

    public String getCorChapeu() {
        return corChapeu;
    }

    public TipoOculos getOculos() {
        return oculos;
    }

    public String getCorOculos() {
        return corOculos;
    }

    public EstiloOutro getEstiloOutro() {
        return estiloOutro;
    }

    public String getCorOutro() {
        return corOutro;
    }
}
