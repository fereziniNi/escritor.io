package io.escritor.presenca.identidade.domain;

/** Personalização de avatar (pedido do usuário: "o personagem fosse mais detalhado... a opção
 * para todos detalhar da melhor maneira possível o avatar") - `CARECA` não desenha nenhuma forma
 * de cabelo no avatar (ver `avatarFactory.ts`/`PixelCharacterSvg.tsx` no frontend), os demais são
 * variantes de silhueta. */
public enum EstiloCabelo {
    CARECA,
    CURTO,
    MEDIO,
    LONGO
}
