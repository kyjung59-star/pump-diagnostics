"""
PWA/앱 아이콘 생성 — design/ 폴더의 마스터 이미지(1024px)를 여러 사이즈로 줄여 public/ 에 저장한다.
디자인(물방울 + 압력 게이지 + 진단 맥박선)은 design/icon-*.svg 가 원본이다.
  - icon-any-1024.png       : 모서리가 둥근 사각형(투명 모서리) — 일반 용도 아이콘
  - icon-maskable-1024.png  : 꽉 찬 배경 + 중앙 80% 안전 영역 — 안드로이드 마스커블/런처용
  - icon-store-1024.png     : 꽉 찬 정사각형 — Play 스토어 아이콘(512px로 줄여 업로드), 애플 터치 아이콘
사용법: python3 make_icons.py   (Pillow 필요)
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).parent
DESIGN = ROOT / "design"
OUT = ROOT / "public" / "icons"
SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]


def resized(src: str, size: int) -> Image.Image:
    return Image.open(DESIGN / src).convert("RGBA").resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        resized("icon-any-1024.png", s).save(OUT / f"icon-{s}.png", optimize=True)
    resized("icon-maskable-1024.png", 512).convert("RGB").save(OUT / "icon-maskable-512.png", optimize=True)
    resized("icon-store-1024.png", 180).convert("RGB").save(ROOT / "public" / "apple-touch-icon.png", optimize=True)
    resized("icon-store-1024.png", 512).convert("RGB").save(DESIGN / "play-store-icon-512.png", optimize=True)
    print("아이콘 생성 완료:", SIZES)
