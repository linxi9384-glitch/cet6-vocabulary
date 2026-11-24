"""Raster app icons matching the book symbol used in the site."""

from pathlib import Path

from PIL import Image, ImageDraw


def main():
    site = Path(__file__).resolve().parents[1] / "site"
    image = Image.new("RGB", (1024, 1024), "#205643")
    draw = ImageDraw.Draw(image)
    pages = [(512, 357), (440, 306), (275, 306), (275, 680), (437, 680), (512, 719),
             (587, 680), (749, 680), (749, 306), (584, 306), (512, 357), (512, 719)]
    draw.line(pages, fill="#f4faf0", width=31, joint="curve")
    for x, y in pages:
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), fill="#f4faf0")
    for size in (192, 512):
        image.resize((size, size), Image.Resampling.LANCZOS).save(site / f"app-{size}.png", optimize=True)


if __name__ == "__main__":
    main()
