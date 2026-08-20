"""
PWA 앱 아이콘 생성 — 헤더의 물방울 로고 컨셉(앰버 원형 배경 + 흰 물방울)을
여러 사이즈로 렌더링한다. 웹 UI의 테마 색상(T.bg, T.amber)과 맞춘다.
"""
from PIL import Image, ImageDraw

BG = (20, 23, 26, 255)       # T.bg #14171A
AMBER = (242, 169, 59, 255)  # T.amber #F2A93B
WHITE = (233, 237, 240, 255)  # T.text #E9EDF0

SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]


def draw_droplet(draw, cx, cy, scale):
    """단순화된 물방울 두 개(lucide Droplets 컨셉) 아이콘을 그린다."""
    # 큰 물방울
    r = 0.34 * scale
    top_y = cy - 0.62 * scale
    draw.ellipse([cx - r, cy - r * 0.15, cx + r, cy + r * 1.85], fill=WHITE)
    draw.polygon([
        (cx, top_y),
        (cx - r * 0.95, cy + r * 0.55),
        (cx + r * 0.95, cy + r * 0.55),
    ], fill=WHITE)


def make_icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * (0.12 if maskable else 0.06))
    box = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.22)

    draw.rounded_rectangle(box, radius=radius, fill=BG, outline=AMBER, width=max(2, size // 40))
    draw_droplet(draw, size / 2, size / 2 + size * 0.03, size * 0.5)

    return img


if __name__ == "__main__":
    out_dir = "/home/claude/pump-site/public/icons"
    for s in SIZES:
        make_icon(s).save(f"{out_dir}/icon-{s}.png")
    # 마스커블 아이콘(안드로이드 어댑티브 아이콘용, 여백 더 확보)
    make_icon(512, maskable=True).save(f"{out_dir}/icon-maskable-512.png")
    # 애플 터치 아이콘
    make_icon(180).save("/home/claude/pump-site/public/apple-touch-icon.png")
    print("아이콘 생성 완료:", SIZES)
