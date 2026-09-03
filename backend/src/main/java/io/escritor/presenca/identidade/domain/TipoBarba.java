package io.escritor.presenca.identidade.domain;

/** Personalização de avatar (ver {@link EstiloCabelo}) - nova categoria (Base → Barba), pedido do
 * usuário depois de mandar o print do editor do Gather como referência ("Facial Hair" é uma
 * sub-aba própria lá). `NENHUM` não desenha nada; os demais usam a cor do cabelo (`corCabelo`),
 * sem paleta própria - não faz sentido a barba ter uma cor independente do cabelo na maioria dos
 * casos, e uma grade de cor a mais deixaria o editor mais lento de usar sem ganho real. */
public enum TipoBarba {
    NENHUM,
    BIGODE,
    CAVANHAQUE,
    BARBA_CHEIA
}
