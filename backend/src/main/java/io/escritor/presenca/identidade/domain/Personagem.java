package io.escritor.presenca.identidade.domain;

/**
 * Pedido do usuário: "adicionar game-assets... sobre characteres" - substitui o sistema de
 * personalização por camadas (pele/cabelo/roupa/acessórios, tudo desenhado via `PIXI.Graphics`,
 * removido junto com este enum entrando) por sprite de verdade. Fonte: Kenney RPG Urban Pack
 * (CC0, ver `frontend/public/personagens/LICENSE.txt`) - 6 personagens prontos, cada um com um
 * ciclo de caminhada de 12 quadros (só de frente; direção esquerda/direita é espelhada no
 * frontend, não tem sprite separado pra isso). Sem sistema de camadas por trás - o nome de cada
 * valor já é o personagem inteiro, não uma combinação de partes.
 */
public enum Personagem {
    PERSONAGEM_VERDE,
    PERSONAGEM_VERMELHO,
    PERSONAGEM_ROXO,
    PERSONAGEM_CHAPEU,
    PERSONAGEM_CINZA,
    PERSONAGEM_BANDANA
}
