"""Language, direction, digits and contrast tokens in scaffold (NM-09, NM-22)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import ROOT, example_plan, load_deck_helper

dh = load_deck_helper()
BUNDLED = [name for _f, name, _x, _w in dh.FONT_CATALOGUE if (dh.FONTS_SOURCE_DIR / name).exists()]


def render(plan: dict) -> str:
    html, _, _ = dh.render_deck(plan, Path("/nonexistent"), font_files=BUNDLED)
    return html


class DirectionTest(unittest.TestCase):
    def test_arabic_is_rtl_and_english_ltr(self):
        self.assertIn('<html lang="ar" dir="rtl">', render(example_plan()))
        en = dh.make_stub_plan("A deck", 6, "en")
        html = render(en)
        self.assertIn('<html lang="en" dir="ltr">', html)
        self.assertIn('<body dir="ltr"', html)

    def test_english_scaffold_has_no_arabic(self):
        html = render(dh.make_stub_plan("A deck", 12, "en"))
        visible = html.split("</style>", 1)[1]
        visible = "".join(part.split("-->", 1)[-1] for part in visible.split("<!--"))
        self.assertIsNone(dh._ARABIC_LETTER.search(visible.replace("ستابر", "")), "Arabic text in an English scaffold")

    def test_plan_init_lang(self):
        with tempfile.TemporaryDirectory() as tmp:
            r = subprocess.run([sys.executable, str(ROOT / "scripts" / "deck_helper.py"), "plan-init", "--target-dir", tmp,
                                "--title", "Ports", "--lang", "en"], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            plan = json.loads((Path(tmp) / "deck.plan.json").read_text(encoding="utf-8"))
            self.assertEqual(plan["lang"], "en")
            self.assertTrue(dh.lint_plan(plan)["passed"])


class DigitsTest(unittest.TestCase):
    def test_starter_data_follows_the_plan(self):
        western = example_plan()  # writes "70%"
        self.assertFalse(dh._plan_uses_arabic_digits(western))
        self.assertNotRegex(render(western).split("<body", 1)[1], "[٠-٩]")
        arabic = example_plan()
        arabic["slides"][4]["text"]["stat"]["value"] = "٧٠٪"
        self.assertTrue(dh._plan_uses_arabic_digits(arabic))
        self.assertIn("٢٠٢٣", render(arabic))

    def test_english_uses_western_digits(self):
        self.assertFalse(dh._plan_uses_arabic_digits({"lang": "en", "slides": [{"text": {"headline": "٧"}}]}))


class BidiTest(unittest.TestCase):
    def setUp(self):
        dh._SCAFFOLD.update(lang="ar")

    def test_risky_runs_are_isolated(self):
        self.assertEqual(dh._text("نموذج GPT-4 (2023) جديد"), "نموذج <bdi>GPT-4 (2023)</bdi> جديد")
        self.assertEqual(dh._text("الإصدار v2.1 أسرع"), "الإصدار <bdi>v2.1</bdi> أسرع")

    def test_plain_latin_words_and_english_text_are_left_alone(self):
        self.assertEqual(dh._text("يعمل Transformer بالانتباه"), "يعمل Transformer بالانتباه")
        self.assertEqual(dh._text("the model GPT-4 (2023)"), "the model GPT-4 (2023)")
        dh._SCAFFOLD.update(lang="en")
        self.assertEqual(dh._text("نموذج GPT-4"), "نموذج GPT-4")

    def test_text_is_still_escaped(self):
        self.assertEqual(dh._text("أ < ب & ج"), "أ &lt; ب &amp; ج")


class OnAccentTest(unittest.TestCase):
    def test_every_preset_meets_contrast_on_accent(self):
        presets = json.loads((ROOT / "resources" / "templates" / "themes.json").read_text(encoding="utf-8"))["presets"]
        for name, tokens in presets.items():
            css = dh._theme_css_vars(tokens)
            on = next(l for l in css.split("\n") if "--nm-on-accent" in l).split(":")[1].strip(" ;")
            self.assertGreaterEqual(dh.contrast_ratio(on, tokens["accent"]), 4.5, name)


if __name__ == "__main__":
    unittest.main()
