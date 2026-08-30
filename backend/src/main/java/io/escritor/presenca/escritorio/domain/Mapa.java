package io.escritor.presenca.escritorio.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * PRD §3.5/§6: sem editor visual (fora de escopo v1) - o {@code layoutJson} do mapa é definido à
 * mão e versionado no repositório via migração Flyway (ver V20__create_mapa.sql), não por um
 * formulário de admin. {@code ativo} decide qual mapa o frontend carrega (S6.2).
 */
@Entity
@Table(name = "mapa")
public class Mapa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "largura_tiles", nullable = false)
    private int larguraTiles;

    @Column(name = "altura_tiles", nullable = false)
    private int alturaTiles;

    @Column(name = "layout_json", nullable = false)
    private String layoutJson;

    @Column(nullable = false)
    private boolean ativo;

    protected Mapa() {
        // JPA
    }

    public Mapa(String nome, int larguraTiles, int alturaTiles, String layoutJson, boolean ativo) {
        if (nome == null || nome.isBlank()) {
            throw new NomeMapaObrigatorioException();
        }
        if (larguraTiles <= 0 || alturaTiles <= 0) {
            throw new DimensaoMapaInvalidaException();
        }
        if (layoutJson == null || layoutJson.isBlank()) {
            throw new LayoutJsonObrigatorioException();
        }
        this.nome = nome;
        this.larguraTiles = larguraTiles;
        this.alturaTiles = alturaTiles;
        this.layoutJson = layoutJson;
        this.ativo = ativo;
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public int getLarguraTiles() {
        return larguraTiles;
    }

    public int getAlturaTiles() {
        return alturaTiles;
    }

    public String getLayoutJson() {
        return layoutJson;
    }

    public boolean isAtivo() {
        return ativo;
    }
}
