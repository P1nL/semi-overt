#!/usr/bin/env python3
"""生成朝华标题字体的 Web 常用字子集。

依赖：python -m pip install "fonttools[woff]"
输入：assets-source/fonts/ZhaohuaMinB-Black.woff2
输出：src/shared/assets/fonts/ZhaohuaMinB-Black-common.woff2
"""

from __future__ import annotations

from pathlib import Path

try:
    from fontTools import subset
    from fontTools.ttLib import TTFont
except ImportError as error:
    raise SystemExit(
        '缺少 fontTools，请先执行：python -m pip install "fonttools[woff]"'
    ) from error

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets-source" / "fonts" / "ZhaohuaMinB-Black.woff2"
OUTPUT = ROOT / "src" / "shared" / "assets" / "fonts" / "ZhaohuaMinB-Black-common.woff2"
SOURCE_EXTENSIONS = {".vue", ".ts", ".js", ".css", ".html", ".json", ".md"}
BASE_CHARACTERS = (
    " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    "<>=~+-/·•，。！？：；“”‘’（）【】《》…—"
)


def collect_project_characters() -> set[str]:
    characters = set(BASE_CHARACTERS)

    for path in (ROOT / "src").rglob("*"):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue

        try:
            characters.update(path.read_text(encoding="utf-8"))
        except UnicodeDecodeError:
            continue

    index_html = ROOT / "index.html"
    if index_html.exists():
        characters.update(index_html.read_text(encoding="utf-8"))

    return characters


def collect_gb2312_level_one() -> set[str]:
    """GB2312 一级汉字区 B0A1-D7F9，覆盖常用简体中文。"""
    characters: set[str] = set()

    for lead in range(0xB0, 0xD8):
        for trail in range(0xA1, 0xFF):
            try:
                characters.add(bytes((lead, trail)).decode("gb2312"))
            except UnicodeDecodeError:
                continue

    return characters


def assert_subsetting_allowed(font: TTFont) -> None:
    fs_type = font["OS/2"].fsType
    if fs_type & 0x0100:
        raise SystemExit("字体 OS/2.fsType 设置了 No subsetting，已停止生成。")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"找不到字体源文件：{SOURCE}")

    source_font = TTFont(SOURCE, lazy=True)
    assert_subsetting_allowed(source_font)
    source_font.close()

    characters = collect_project_characters() | collect_gb2312_level_one()

    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]

    font = subset.load_font(str(SOURCE), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text="".join(sorted(characters)))
    subsetter.subset(font)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = OUTPUT.with_suffix(".tmp.woff2")
    subset.save_font(font, str(temporary_output), options)
    temporary_output.replace(OUTPUT)

    generated_font = TTFont(OUTPUT, lazy=True)
    covered_codepoints = len(generated_font.getBestCmap() or {})
    generated_font.close()

    source_bytes = SOURCE.stat().st_size
    output_bytes = OUTPUT.stat().st_size
    reduction = (1 - output_bytes / source_bytes) * 100
    print(f"源字体：{source_bytes:,} bytes")
    print(f"子集字体：{output_bytes:,} bytes")
    print(f"覆盖字符：{covered_codepoints:,}")
    print(f"体积降低：{reduction:.1f}%")
    print(f"输出：{OUTPUT}")


if __name__ == "__main__":
    main()
