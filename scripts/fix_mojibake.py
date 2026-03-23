from __future__ import annotations

import argparse
from pathlib import Path


TEXT_EXTENSIONS = {
    ".java",
    ".kt",
    ".xml",
    ".yml",
    ".yaml",
    ".properties",
    ".sql",
    ".md",
    ".txt",
    ".json",
    ".pom",
}

SUSPICIOUS_TOKENS = (
    "鍏",
    "璇",
    "鏈",
    "閭",
    "鐧",
    "鏉",
    "娉",
    "寮",
    "鍒",
    "鍙",
    "鏁",
    "绔",
    "鏍",
    "缂",
    "榛",
    "閰",
    "鍐",
    "澶",
    "绠",
    "璁",
    "鍚",
    "瑙",
    "绫",
    "閫",
    "浣",
    "鐢",
    "娑",
    "眰",
    "暟",
    "獙",
    "紑",
    "緫",
    "瓧",
    "绗",
    "鍥",
    "彂",
    "鍧",
    "瀛",
    "爜",
    "鍐欏叆",
    "缂撳瓨",
    "鎺ュ彛",
)


def suspicious_score(text: str) -> int:
    return sum(text.count(token) for token in SUSPICIOUS_TOKENS)


def repair_line(line: str) -> str:
    if suspicious_score(line) == 0:
        return line

    try:
        candidate = line.encode("gbk").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return line

    original_score = suspicious_score(line)
    candidate_score = suspicious_score(candidate)

    if candidate_score >= original_score:
        return line

    return candidate


def repair_text(text: str) -> tuple[str, int]:
    repaired_lines = []
    changed = 0

    for line in text.splitlines(keepends=True):
        repaired = repair_line(line)
        if repaired != line:
            changed += 1
        repaired_lines.append(repaired)

    return "".join(repaired_lines), changed


def iter_text_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in {"target", ".idea", ".git"} for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        yield path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    total_files = 0
    changed_files = 0

    for path in iter_text_files(args.root):
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        repaired, changed_lines = repair_text(text)
        if changed_lines == 0:
            continue

        total_files += 1
        changed_files += 1
        print(f"{path}\t{changed_lines}")

        if args.write:
            path.write_text(repaired, encoding="utf-8", newline="")

    print(f"changed_files={changed_files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
