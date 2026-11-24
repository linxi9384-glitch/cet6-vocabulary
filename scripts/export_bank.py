"""Export the existing CET-6 workbook edition as a standalone website asset."""

import argparse
from collections import Counter
import json
from pathlib import Path
import sys


VARIANTS = {
    "utilize": ["utilise"],
    "subsidize": ["subsidise"],
    "glamour": ["glamor"],
    "characterize": ["characterise"],
    "fertilizer": ["fertiliser"],
    "generalize": ["generalise"],
    "specialise": ["specialize"],
    "publicize": ["publicise"],
    "jeopardize": ["jeopardise"],
}


def export(source, workbook_dir, output):
    sys.path.insert(0, str(workbook_dir.resolve()))
    from build_dual_column import assemble_chapters, load_edition

    rows, glosses, forms, groups = load_edition(source, True)
    chapters = assemble_chapters(rows, groups)
    blocks = [block for chapter in chapters for _, part in chapter for block in part]
    assert [unit for chapter in chapters for unit, _ in chapter] == list(range(1, 65))
    assert len(chapters) == 4 and all(len(chapter) == 16 for chapter in chapters)
    assert all(sum(len(ids) for _, ids, _ in part) == 14 for chapter in chapters for _, part in chapter)
    assert Counter(key for _, ids, _ in blocks for key in ids) == Counter(rows.keys())
    assert Counter(block for block in blocks if block[0]) == Counter(groups)
    assert len(rows) == len(glosses) == 896 and len(groups) == 108 and len(forms) == 367
    assert VARIANTS.keys() <= set(rows.values())

    words = {}
    for key, english in rows.items():
        word = {"id": key, "en": english, "gloss": glosses[key]}
        if key in forms:
            word["notes"] = forms[key]
        if english in VARIANTS:
            word["variants"] = VARIANTS[english]
        words[key] = word

    bank = {
        "edition": "cet6-workbook-v1",
        "words": words,
        "chapters": [
            {
                "id": index,
                "units": [
                    {
                        "id": unit,
                        "blocks": [
                            {"ids": ids, **({"tag": tag, "note": note} if tag else {})}
                            for tag, ids, note in entries
                        ],
                    }
                    for unit, entries in chapter
                ],
            }
            for index, chapter in enumerate(chapters, 1)
        ],
    }
    output.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Exported and verified 896 entries, 64 units, 108 groups and 367 annotations.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("workbook_dir", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "site" / "bank.json")
    args = parser.parse_args()
    export(args.source, args.workbook_dir, args.output)
