"""Compõe 6 novos rostos humanos combinando cabeça-base + nariz + sobrancelha do LPC (assets que
já são overlays desenhados pra encaixar por cima de qualquer cabeça "adult" padrão) - resolve o
"são poucas que trazem poucas diferenças" sem inventar formato de cabeça novo (o LPC só tem os 10
que já usamos). Composição feita uma vez aqui (client final só carrega 1 PNG por opção, igual a
todas as outras camadas - arquitetura de renderização não muda nada)."""
from PIL import Image

REPO = "C:/Users/leanc/AppData/Local/Temp/claude/c--Users-leanc-claude-code-escritor-io/3f67526c-169f-4507-b0cc-087ed8373608/scratchpad/lpc/repo/spritesheets"
DEST = "c:/Users/leanc/claude_code/escritor.io/frontend/public/personagem-lpc/head"

COMBOS = [
    ("PADRAO_MARCANTE", "human/male", "big", "thick"),
    ("PADRAO_DELICADO", "human/male", "button", "thin"),
    ("OVAL_MARCANTE", "human/female", "large", "thick"),
    ("OVAL_DELICADO", "human/female", "button", "thin"),
    ("ENVELHECIDA_MARCANTE", "human/male_elderly", "elderly", "thick"),
    ("OVAL_ENVELHECIDA_MARCANTE", "human/female_elderly", "elderly", "thin"),
]

for nome, cabeca, nariz, sobrancelha in COMBOS:
    base = Image.open(f"{REPO}/head/heads/{cabeca}/walk.png").convert("RGBA")
    nariz_img = Image.open(f"{REPO}/head/nose/{nariz}/adult/walk.png").convert("RGBA")
    brow_img = Image.open(f"{REPO}/eyes/eyebrows/{sobrancelha}/adult/walk.png").convert("RGBA")
    out = base.copy()
    out.alpha_composite(nariz_img)
    out.alpha_composite(brow_img)
    assert out.size == (576, 256), out.size
    out.save(f"{DEST}/{nome}.png")
    print(f"{nome}: cabeca={cabeca} nariz={nariz} sobrancelha={sobrancelha} -> salvo")

print("OK - 6 rostos compostos")
