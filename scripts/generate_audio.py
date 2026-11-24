"""Generate static CET-6 pronunciation clips with Doubao Voice."""

import argparse
import base64
from binascii import Error as Base64Error
from getpass import getpass
import hashlib
import json
import os
from pathlib import Path
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/create"
SITE = Path(__file__).resolve().parents[1] / "site"
ACCENTS = {"en-US": "General American", "en-GB": "standard British"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def synthesize(opener, key, text, accent, speaker):
    payload = {
        "model": "seed-audio-1.0",
        "text_prompt": (
            f"Read the following vocabulary entry exactly once in clear {ACCENTS[accent]} "
            f"English, at a natural pace. No introduction, repetition, music, or sound effects. "
            f"Speak only this text: {json.dumps(text, ensure_ascii=False)}"
        ),
        "audio_config": {"format": "mp3", "sample_rate": 24000},
    }
    if speaker:
        payload["references"] = [{"speaker": speaker}]
    request = Request(ENDPOINT, data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "X-Api-Key": key,
        "X-Api-Request-Id": str(uuid4()),
    })
    try:
        with opener.open(request, timeout=180) as response:
            result = json.load(response)
    except HTTPError as error:
        if error.code == 401:
            raise ValueError("HTTP 401: Doubao Voice rejected the API key") from None
        raise ValueError(f"Doubao Voice returned HTTP {error.code}") from None
    except URLError as error:
        raise ValueError("Could not reach Doubao Voice") from error

    if not isinstance(result, dict):
        raise ValueError("Doubao Voice returned an invalid audio response")
    try:
        audio = base64.b64decode(result.get("audio", ""), validate=True)
    except (Base64Error, TypeError, ValueError):
        raise ValueError("Doubao Voice returned invalid Base64 audio") from None
    if not (audio.startswith(b"ID3") or (len(audio) >= 4 and audio[0] == 0xff and audio[1] & 0xe0 == 0xe0)):
        raise ValueError("Doubao Voice did not return MP3 audio")
    return audio


def save_atomic(path, data):
    temp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temp.write_bytes(data)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--id", type=int, action="append", help="generate a selected word (repeatable)")
    selection.add_argument("--all", action="store_true", help="generate the missing vocabulary clips")
    parser.add_argument("--accent", choices=ACCENTS, default="en-US")
    parser.add_argument("--speaker", help="optional Volcengine speaker ID")
    args = parser.parse_args()

    bank = json.loads((SITE / "bank.json").read_text(encoding="utf-8"))
    words = bank["words"]
    ids = list(words) if args.all else list(dict.fromkeys(map(str, args.id)))
    if any(identifier not in words for identifier in ids):
        parser.error("one or more IDs are not in the vocabulary")

    audio_root = SITE / "audio"
    manifest_path = audio_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest["edition"] != bank["edition"]:
        raise ValueError("The audio manifest belongs to a different vocabulary edition")
    clips = manifest["clips"].setdefault(args.accent, {})
    folder = audio_root / args.accent
    pending = [identifier for identifier in ids
               if not clips.get(identifier) or not (folder / f"{identifier}-{clips[identifier]}.mp3").is_file()]
    if not pending:
        print("All selected clips already exist.")
        return 0

    key = os.environ.get("VOLCENGINE_SPEECH_API_KEY", "").strip()
    if not key and sys.stdin.isatty():
        key = getpass("Doubao Voice API key: ").strip()
    if not key:
        parser.error("set VOLCENGINE_SPEECH_API_KEY or use the hidden prompt in a terminal")

    opener = build_opener(NoRedirect)
    folder.mkdir(exist_ok=True)
    for identifier in pending:
        audio = synthesize(opener, key, words[identifier]["en"], args.accent, args.speaker)
        digest = hashlib.sha256(audio).hexdigest()[:12]
        save_atomic(folder / f"{identifier}-{digest}.mp3", audio)
        clips[identifier] = digest
        save_atomic(manifest_path, (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8"))
        print(f"Saved {args.accent} #{identifier}: {words[identifier]['en']}", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        sys.exit(str(error))
