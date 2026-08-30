package io.escritor.presenca.escritorio.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/**
 * {@code tipo} decide o status automático de quem entra na zona (S6.7). A checagem de que a zona
 * cabe dentro do mapa fica aqui, na entidade, porque só depende dos dois objetos envolvidos - sem
 * precisar olhar zonas irmãs (diferente de {@code ordem} única em {@link
 * io.escritor.presenca.kanban.domain.Coluna}, que exige o serviço).
 */
@Entity
@Table(name = "zona")
public class Zona {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mapa_id", nullable = false)
    private Mapa mapa;

    @Column(nullable = false)
    private String nome;

    @Column(nullable = false)
    private int x;

    @Column(nullable = false)
    private int y;

    @Column(nullable = false)
    private int largura;

    @Column(nullable = false)
    private int altura;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoZona tipo;

    protected Zona() {
        // JPA
    }

    public Zona(Mapa mapa, String nome, int x, int y, int largura, int altura, TipoZona tipo) {
        if (nome == null || nome.isBlank()) {
            throw new NomeZonaObrigatorioException();
        }
        if (x < 0 || y < 0 || largura <= 0 || altura <= 0) {
            throw new DimensaoZonaInvalidaException();
        }
        if (tipo == null) {
            throw new TipoZonaObrigatorioException();
        }
        if (mapa != null && (x + largura > mapa.getLarguraTiles() || y + altura > mapa.getAlturaTiles())) {
            throw new ZonaForaDosLimitesDoMapaException();
        }
        this.mapa = mapa;
        this.nome = nome;
        this.x = x;
        this.y = y;
        this.largura = largura;
        this.altura = altura;
        this.tipo = tipo;
    }

    public Long getId() {
        return id;
    }

    public Mapa getMapa() {
        return mapa;
    }

    public String getNome() {
        return nome;
    }

    public int getX() {
        return x;
    }

    public int getY() {
        return y;
    }

    public int getLargura() {
        return largura;
    }

    public int getAltura() {
        return altura;
    }

    public TipoZona getTipo() {
        return tipo;
    }
}
