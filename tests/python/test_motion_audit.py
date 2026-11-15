"""audit-deck on data-at (NM-14) and the optional GSAP act (NM-17)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import ROOT

HELPER = ROOT / "scripts" / "deck_helper.py"


def audit(html: str) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        project = Path(tmp)
        subprocess.run([sys.executable, str(HELPER), "stage-runtime", "--target-dir", tmp], capture_output=True, check=True)
        (project / "deck.html").write_text(html, encoding="utf-8")
        out = project / "audit.json"
        subprocess.run([sys.executable, str(HELPER), "audit-deck", "--html-path", str(project / "deck.html"), "--output", str(out)], capture_output=True)
        return json.loads(out.read_text(encoding="utf-8"))


def deck(slide: str, scripts: str = "") -> str:
    return f"""<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="nm-runtime" content="2">
<link rel="stylesheet" href="assets/nm/nm-deck.css"></head><body dir="rtl"><div class="deck-viewport"><main class="deck-stage" id="deckStage">
<section class="slide"><div class="camera-rig"><svg></svg>{slide}</div></section></main></div>
<script src="assets/nm/nm-deck.js"></script>{scripts}</body></html>"""


class MotionAuditTest(unittest.TestCase):
    def test_gsap_act_is_known_and_needs_its_adapter(self):
        r = audit(deck('<p data-step="1" data-act="gsap">نص</p>'))
        self.assertFalse(any("vocabulary" in e for e in r["errors"]), r["errors"])
        self.assertTrue(any("nm-gsap.js" in e for e in r["errors"]))
        r = audit(deck('<p data-step="1" data-act="gsap">نص</p>', '<script src="assets/nm/nm-gsap.js"></script>'))
        self.assertFalse([e for e in r["errors"] if "gsap" in e or "vocabulary" in e], r["errors"])
        self.assertTrue(any("does not bundle" in w for w in r["warnings"]), "GSAP itself is missing")

    def test_data_at_syntax(self):
        good = "".join(f'<p data-step="1" data-at="{v}">نص</p>' for v in ("&lt;", "&gt;", "+=200", "-=100", "&lt;+=150", "300", "0.3s", "@mid+=50"))
        self.assertFalse(any("data-at" in w for w in audit(deck(good))["warnings"]))
        bad = audit(deck('<p data-step="1" data-at="after the title">نص</p>'))
        self.assertTrue(any('data-at="after the title"' in w for w in bad["warnings"]))


if __name__ == "__main__":
    unittest.main()
