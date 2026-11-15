"""Golden corpus (tests/corpus): scaffold output is unchanged and every corpus deck passes the static gates.

A failure here means a change altered what the skill writes for an existing plan. If that is intended, rebuild
the goldens with `python3 tests/corpus/build.py --update`, review the diff, and say why in the commit message
(tests/corpus/README.md).
"""
from __future__ import annotations

import difflib
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = ROOT / "tests" / "corpus"
spec = importlib.util.spec_from_file_location("corpus_build", CORPUS / "build.py")
corpus = importlib.util.module_from_spec(spec)
spec.loader.exec_module(corpus)


class CorpusTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.built = {d["name"]: corpus.build(d, Path(cls.tmp.name)) for d in corpus.decks()}

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_corpus_uses_only_repository_files(self):
        for deck in corpus.decks():
            self.assertTrue((ROOT / deck["source"]).exists(), deck["source"])

    def test_scaffold_output_matches_golden(self):
        for deck in corpus.decks():
            if deck["kind"] != "plan":
                continue
            golden = (CORPUS / "golden" / f"{deck['name']}.scaffold.html").read_text(encoding="utf-8")
            built = self.built[deck["name"]].read_text(encoding="utf-8")
            if built != golden:
                diff = "".join(list(difflib.unified_diff(golden.splitlines(True), built.splitlines(True), "golden", "built"))[:40])
                self.fail(f"{deck['name']}: scaffold output differs from tests/corpus/golden\n{diff}")

    def test_every_corpus_deck_passes_audit(self):
        for name, html in self.built.items():
            report = html.parent / "audit.json"
            r = subprocess.run([sys.executable, str(ROOT / "scripts" / "deck_helper.py"), "audit-deck",
                                "--html-path", str(html), "--output", str(report)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"{name}: {r.stdout}{r.stderr}")
            self.assertTrue(json.loads(report.read_text(encoding="utf-8"))["passed"], name)


if __name__ == "__main__":
    unittest.main()
