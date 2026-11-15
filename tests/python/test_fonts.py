"""Font catalogue, user-installed fonts and the open-pairing fallback (decision D2)."""
from __future__ import annotations

import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from _helpers import example_plan, load_deck_helper

dh = load_deck_helper()
THMANYAH = [name for family, name, _f, _w in dh.FONT_CATALOGUE if family.startswith("Thmanyah")]
BUNDLED = [name for _fam, name, _f, _w in dh.FONT_CATALOGUE if (dh.FONTS_SOURCE_DIR / name).exists()]


class BundleTest(unittest.TestCase):
    def test_restricted_fonts_are_not_bundled(self):
        for family, name, _f, _w in dh.FONT_CATALOGUE:
            if family in dh.USER_INSTALLED_FONTS:
                self.assertFalse((dh.FONTS_SOURCE_DIR / name).exists(), name)

    def test_open_pairing_is_fully_bundled(self):
        families = dh._available_families(BUNDLED)
        self.assertEqual(dh.resolve_pairing(dh.OPEN_PAIRING, families), dh.OPEN_PAIRING)


class PairingTest(unittest.TestCase):
    def test_fallback_without_thmanyah(self):
        families = dh._available_families(BUNDLED)
        self.assertEqual(dh.resolve_pairing("thmanyah", families), "open")
        self.assertEqual(dh.resolve_pairing("sans", families), "open")
        self.assertEqual(dh.resolve_pairing("kufi", families), "kufi")

    def test_thmanyah_kept_when_installed(self):
        families = dh._available_families(BUNDLED + THMANYAH)
        self.assertEqual(dh.resolve_pairing("thmanyah", families), "thmanyah")

    def test_render_declares_only_available_files(self):
        html, _, _ = dh.render_deck(example_plan(), Path("/nonexistent"), font_files=BUNDLED)
        self.assertNotIn("thmanyah", html.lower().split("<body")[0].replace("font-mode-thmanyah", ""))
        self.assertIn('class="font-mode-open"', html)
        self.assertIn("ReadexPro-VF.ttf", html)
        self.assertNotIn("{{", html)

    def test_render_with_thmanyah_installed(self):
        html, _, _ = dh.render_deck(example_plan(), Path("/nonexistent"), font_files=BUNDLED + THMANYAH)
        self.assertIn('class="font-mode-thmanyah"', html)
        self.assertIn("assets/fonts/thmanyahsans-Regular.otf", html)


class StageFontsTest(unittest.TestCase):
    def test_user_fonts_dir_is_used(self):
        with tempfile.TemporaryDirectory() as fonts, tempfile.TemporaryDirectory() as project:
            for name in THMANYAH:
                Path(fonts, name.upper()).write_bytes(b"fake")  # case-insensitive match
            with mock.patch.dict(os.environ, {"NM_FONTS_DIR": fonts}):
                result = dh._stage_fonts(Path(project))
            self.assertEqual(result["status"], "ok")
            self.assertIn("Thmanyah Sans", result["families"])
            self.assertTrue(Path(project, "assets", "fonts", "thmanyahsans-Regular.otf").exists())
            self.assertEqual(result["missing_hint"].count("Thmanyah"), 0)

    def test_hint_when_missing(self):
        with tempfile.TemporaryDirectory() as empty, tempfile.TemporaryDirectory() as project:
            with mock.patch.object(dh, "_user_font_dirs", return_value=[Path(empty)]):
                result = dh._stage_fonts(Path(project))
            self.assertEqual(result["status"], "ok")
            self.assertIn("Thmanyah", result["missing_hint"])
            self.assertEqual(sorted(os.listdir(Path(project, "assets", "fonts"))), sorted(BUNDLED))


if __name__ == "__main__":
    unittest.main()
