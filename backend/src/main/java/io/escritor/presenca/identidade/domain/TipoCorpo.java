package io.escritor.presenca.identidade.domain;

/** Personalização de avatar - formato do corpo (silhueta base, antes de qualquer roupa). Pedido
 * do usuário depois da virada pra pixel art real (LPC): "O personagem pode ser masculino ou
 * feminino também!" - até aqui o corpo era sempre a mesma silhueta masculina (decisão da
 * curadoria original: "1 gênero de base pro avatar"), independente da cabeça (`TipoRosto`) ou de
 * qualquer outra coisa escolhida. Sem paleta de cor própria - usa `corPele`, mesmo padrão de
 * {@link TipoRosto}.
 *
 * <p>Roupa (Top/Jacket/Bottom/Shoes) tem corte próprio por formato de corpo sempre que o LPC
 * oferece um (a maioria oferece) - ver `mundo/spriteAvatar.ts`. Onde não tem corte feminino
 * disponível no LPC (2 de 9 Top, a maioria dos Jacket), o corte masculino é usado como
 * aproximação - risco visual documentado, não travado. */
public enum TipoCorpo {
    MASCULINO,
    FEMININO
}
