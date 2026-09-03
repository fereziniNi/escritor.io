package io.escritor.presenca.identidade.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * Personalização do avatar (pedido do usuário: "o personagem fosse mais detalhado... a opção para
 * todos detalhar da melhor maneira possível o avatar", com prints reais do editor de personagem do
 * Gather como referência de composição de UI/categorias - não de sprite a copiar, esse continua
 * desenhado via `PIXI.Graphics`/SVG, sem asset de imagem nenhum, mesma regra já estabelecida pro
 * resto do mundo). `@Embeddable` (não uma tabela própria) - é uma parte inerente de quem é o
 * usuário, sempre carregada junto, nunca consultada sozinha.
 *
 * <p>As cores (`corPele`/`corCabelo`/`corRoupa`) são validadas contra uma paleta curada em
 * {@code AparenciaAvatarValidador} - não é um color picker livre (mais fácil de manter tudo
 * combinando visualmente, igual à grade de swatches dos prints de referência).
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
            TipoChapeu chapeu) {
        this.corPele = corPele;
        this.estiloCabelo = estiloCabelo;
        this.corCabelo = corCabelo;
        this.estiloRoupa = estiloRoupa;
        this.corRoupa = corRoupa;
        this.oculos = oculos;
        this.chapeu = chapeu;
    }

    /** Aparência de quem ainda não personalizou nada - mesmos valores do `DEFAULT` das colunas em
     * banco (ver `V30__adiciona_aparencia_avatar.sql`), então usuários criados antes desta versão
     * já nascem com uma aparência válida sem precisar de backfill manual. */
    public static AparenciaAvatar padrao() {
        return new AparenciaAvatar("#f2c9a0", EstiloCabelo.CURTO, "#4a3728", EstiloRoupa.CAMISETA, "#6b7280", TipoOculos.NENHUM, TipoChapeu.NENHUM);
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
}
