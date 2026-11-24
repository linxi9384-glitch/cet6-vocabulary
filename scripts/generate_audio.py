"""Generate static CET-6 pronunciation clips with Doubao Voice."""

import argparse
import base64
from binascii import Error as Base64Error
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from getpass import getpass
import hashlib
import json
import os
from pathlib import Path
import sys
from time import sleep
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


ENDPOINT = "https://voice.cn-beijing.volces.com/api/v3/text-to-speech"
MODEL = "doubao-seed-tts-3.0"
SITE = Path(__file__).resolve().parents[1] / "site"
ACCENT = "en-US"
SPEAKER = "multi_male_jamie_v3_uranus_bigtts"


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def synthesize(opener, key, text, speaker):
    voice_id = quote(speaker or SPEAKER, safe="")
    payload = {
        "model_id": MODEL,
        "text": text,
        "language_code": "en",
        "output_format": {"format": "mp3", "sample_rate": 24000},
    }
    request = Request(f"{ENDPOINT}/{voice_id}/streaming", data=json.dumps(payload).encode("utf-8"), headers={
        "Content-Type": "application/json",
        "X-Api-Key": key,
        "X-Request-Id": str(uuid4()),
    })
    for attempt in range(5):
        try:
            with opener.open(request, timeout=90) as response:
                audio = read_audio_stream(response)
            break
        except HTTPError as error:
            if error.code == 429 and attempt < 4:
                sleep(2 ** attempt)
                continue
            if error.code == 401:
                raise ValueError("HTTP 401: Doubao Voice rejected the API key") from None
            if error.code == 403:
                raise ValueError("HTTP 403: the Doubao model or voice is not granted to this API key") from None
            raise ValueError(f"Doubao Voice returned HTTP {error.code}") from None
        except URLError as error:
            raise ValueError("Could not reach Doubao Voice") from error

    if not (audio.startswith(b"ID3") or (len(audio) >= 4 and audio[0] == 0xff and audio[1] & 0xe0 == 0xe0)):
        raise ValueError("Doubao Voice did not return MP3 audio")
    return audio


def read_audio_stream(lines):
    chunks = bytearray()
    for line in lines:
        if not line.strip():
            continue
        event = json.loads(line)
        if not isinstance(event, dict):
            raise ValueError("Doubao Voice returned an invalid stream event")
        kind = event.get("event")
        if kind == "audio":
            try:
                chunks.extend(base64.b64decode(event.get("audio", ""), validate=True))
            except (Base64Error, TypeError, ValueError):
                raise ValueError("Doubao Voice returned invalid Base64 audio") from None
        elif kind == "error":
            code = event.get("code")
            detail = f" (code {code})" if isinstance(code, int) else ""
            raise ValueError(f"Doubao Voice returned a synthesis error{detail}")
        elif kind == "final" and event.get("reason") == "TTS_STREAM_FINAL_REASON_CLOSED":
            return bytes(chunks)
    raise ValueError("Doubao Voice ended the stream before completing the clip")


def save_atomic(path, data):
    temp = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
    try:
        temp.write_bytes(data)
        for attempt in range(5):
            try:
                temp.replace(path)
                break
            except PermissionError as error:
                if getattr(error, "winerror", None) not in {5, 32} or attempt == 4:
                    raise
                sleep(0.05 * (2 ** attempt))
    finally:
        temp.unlink(missing_ok=True)


def generate_clips(ids, synthesize_word, save_clip, jobs):
    if jobs == 1:
        for identifier in ids:
            save_clip(identifier, synthesize_word(identifier))
        return

    with ThreadPoolExecutor(max_workers=jobs) as executor:
        running = {executor.submit(synthesize_word, identifier): identifier
                   for identifier in ids[:jobs]}
        remaining = iter(ids[jobs:])
        failures = []
        while running:
            done, _ = wait(running, return_when=FIRST_COMPLETED)
            for future in done:
                identifier = running.pop(future)
                try:
                    audio = future.result()
                except (OSError, ValueError) as error:
                    failures.append(f"#{identifier}: {error}")
                else:
                    save_clip(identifier, audio)
            if not failures:
                for identifier in (next(remaining, None) for _ in done):
                    if identifier is not None:
                        running[executor.submit(synthesize_word, identifier)] = identifier
        if failures:
            raise ValueError("\n".join(failures))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--id", type=int, action="append", help="generate a selected word (repeatable)")
    selection.add_argument("--all", action="store_true", help="generate the missing vocabulary clips")
    parser.add_argument("--speaker", help="optional Volcengine speaker ID")
    parser.add_argument("--jobs", type=int, choices=range(1, 9), default=1, help="parallel synthesis requests")
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
    clips = manifest["clips"].setdefault(ACCENT, {})
    folder = audio_root / ACCENT
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

    folder.mkdir(exist_ok=True)

    def synthesize_word(identifier):
        return synthesize(build_opener(NoRedirect), key, words[identifier]["en"], args.speaker)

    def save_clip(identifier, audio):
        digest = hashlib.sha256(audio).hexdigest()[:12]
        save_atomic(folder / f"{identifier}-{digest}.mp3", audio)
        clips[identifier] = digest
        save_atomic(manifest_path, (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode("utf-8"))
        if args.jobs == 1 or len(clips) % 100 == 0 or len(clips) == len(words):
            print(f"Saved {ACCENT} #{identifier}: {words[identifier]['en']} ({len(clips)}/{len(words)})", flush=True)

    generate_clips(pending, synthesize_word, save_clip, args.jobs)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError) as error:
        sys.exit(str(error))
