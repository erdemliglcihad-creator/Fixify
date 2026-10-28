"""Builds Fixify/Resources/Localizable.xcstrings (English source, German translation).

Scans the Swift sources for string literals in localizable positions (Text, Label, Button, …,
String(localized:)), converts interpolations to the format keys Swift generates (%lld for integers,
%@ otherwise), and fills German from tools/de.json. Missing translations are reported and the build
fails, so no German screen silently shows English.

Usage: python tools/build_strings.py [--list]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Fixify"
EXTRA_SOURCES = [ROOT / "Shared", ROOT / "FixifyControls", ROOT / "FixifyBroadcast"]
OUT = SRC / "Resources" / "Localizable.xcstrings"
DE = ROOT / "tools" / "de.json"

CALLS = ["Text", "Label", "Button", "Section", "Toggle", "TextField", "SecureField", "Picker", "NavigationLink",
         "LabeledContent", "Tab", "ContentUnavailableView", "Menu", "navigationTitle", "confirmationDialog", "alert",
         "IntentDialog", "IntentDescription", "displayName", "description"]
START = re.compile(r"(?:\b(?:%s)\(\s*|String\(localized:\s*|prompt:\s*Text\(\s*|LocalizedStringResource = )\"" % "|".join(CALLS))
INT_HINT = re.compile(r"count|number|minutes|index|total|seconds|Int\(|statusCode|analysesPerMonth|updatesPerSession|"
                      r"storedSessions|\.value\b|remaining|imagesPerAnalysis|maxCaptures|- 3")


def read_literal(src, i):
    """Parses a Swift string literal starting after its opening quote. Returns (parts, end)."""
    parts, buf = [], ""
    while i < len(src):
        c = src[i]
        if c == '"':
            parts.append(("text", buf))
            return parts, i + 1
        if c == "\\" and src[i + 1] == "(":
            parts.append(("text", buf))
            buf = ""
            depth, j, in_str = 1, i + 2, False
            while depth:
                ch = src[j]
                if ch == '"' and src[j - 1] != "\\":
                    in_str = not in_str
                elif not in_str and ch == "(":
                    depth += 1
                elif not in_str and ch == ")":
                    depth -= 1
                j += 1
            parts.append(("expr", src[i + 2 : j - 1]))
            i = j
            continue
        if c == "\\":
            nxt = src[i + 1]
            buf += {"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(nxt, nxt)
            i += 2
            continue
        if c == "\n":
            return None, i
        buf += c
        i += 1
    return None, i


def to_key(parts):
    key = ""
    for kind, value in parts:
        if kind == "text":
            key += value.replace("%", "%%")
        else:
            key += "%lld" if INT_HINT.search(value) else "%@"
    return key


def extract():
    keys = {}
    paths = [p for root in [SRC, *EXTRA_SOURCES] if root.exists() for p in root.rglob("*.swift")]
    for path in sorted(paths):
        src = path.read_text(encoding="utf-8")
        for m in START.finditer(src):
            parts, _ = read_literal(src, m.end())
            if not parts:
                continue
            key = to_key(parts)
            if not key.strip() or re.fullmatch(r"[%@lld\s\d.:+–-]*", key):
                continue
            keys.setdefault(key, f"{path.relative_to(ROOT)}")
    return keys


def main():
    keys = extract()
    if "--list" in sys.argv:
        for k in sorted(keys):
            print(json.dumps(k, ensure_ascii=False))
        return
    de = json.loads(DE.read_text(encoding="utf-8")) if DE.exists() else {}
    missing = [k for k in keys if k not in de]
    strings = {}
    for key in sorted(keys):
        entry = {"extractionState": "manual", "localizations": {}}
        if key in de:
            entry["localizations"]["de"] = {"stringUnit": {"state": "translated", "value": de[key]}}
        strings[key] = entry
    OUT.write_text(json.dumps({"sourceLanguage": "en", "strings": strings, "version": "1.0"},
                              ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    unused = sorted(set(de) - set(keys))
    print(f"{len(keys)} keys, {len(keys) - len(missing)} translated -> {OUT.relative_to(ROOT)}")
    if unused:
        print(f"{len(unused)} unused German entries:", *unused[:10], sep="\n  ")
    if missing:
        print(f"{len(missing)} missing German translations:")
        for k in missing:
            print("  ", json.dumps(k, ensure_ascii=False), "←", keys[k])
        sys.exit(1)


if __name__ == "__main__":
    main()
