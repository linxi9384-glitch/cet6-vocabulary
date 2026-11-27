"""Export the English-Chinese lookup files from ECDICT."""

import argparse
import csv
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from string import ascii_lowercase

SITE = Path(__file__).resolve().parents[1] / "site"
WORD = r"[a-z]+(?:['-][a-z]+)*"
TERM = re.compile(rf"{WORD}(?: {WORD}){{0,5}}")
HAN = re.compile(r"[\u3400-\u9fff]")


def normalize(word):
    return " ".join(unicodedata.normalize("NFKC", word).lower().replace("\u2019", "'").split())


def strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from strings(item)
    elif isinstance(value, dict):
        for item in value.values():
            yield from strings(item)


def passage_terms():
    terms = set()
    paths = sorted((SITE / "exam-data").glob("*.json")) + sorted((SITE / "readings").glob("*.json"))
    for path in paths:
        for text in strings(json.loads(path.read_text(encoding="utf-8"))):
            for line in re.findall(rf"{WORD}(?: {WORD})*", normalize(text)):
                words = line.split()
                for start in range(len(words)):
                    terms.update(" ".join(words[start:end]) for end in range(start + 1, min(start + 6, len(words)) + 1))
    return terms


def export(source):
    terms = passage_terms()
    entries = {}
    roots = {}
    forms = {}
    with source.open(encoding="utf-8-sig", newline="") as stream:
        for row in csv.DictReader(stream):
            word = normalize(row["word"])
            if len(word) > 80 or not TERM.fullmatch(word):
                continue
            order = min([int(row[key]) for key in ("frq", "bnc") if int(row[key] or 0) > 0], default=1000000)
            if word not in terms and not row["tag"] and order > 60000:
                continue
            gloss = row["translation"].replace(r"\n", "\n").strip()[:600].strip()
            if not HAN.search(gloss):
                continue
            entries.setdefault(word, gloss)
            for item in row["exchange"].split("/"):
                kind, _, value = item.partition(":")
                form = normalize(value)
                if word == form or len(form) > 80 or not TERM.fullmatch(form):
                    continue
                if kind == "0":
                    roots.setdefault(word, form)
                elif kind in {"p", "d", "i", "3", "r", "t", "s"}:
                    candidate = (order, word)
                    if form not in forms or candidate < forms[form]:
                        forms[form] = candidate

    shards = defaultdict(dict)
    for word, gloss in sorted(entries.items()):
        root = roots.get(word)
        shards[word[0]][word] = [root, entries[root]] if root in entries else [word, gloss]
    for form, (_, word) in sorted(forms.items()):
        shards[form[0]].setdefault(form, [word, entries[word]])

    output = SITE / "dictionary"
    output.mkdir(exist_ok=True)
    for letter in ascii_lowercase:
        (output / f"{letter}.json").write_text(
            json.dumps(shards[letter], ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
        )
    print(f"{len(entries):,} definitions, {sum(map(len, shards.values())):,} lookup keys.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    export(parser.parse_args().csv)
