"""scaffold output is stable, and the bundled showcase passes the static gates from any folder."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import EXAMPLE_PLAN, ROOT, SHOWCASE

HELPER = ROOT / "scripts" / "deck_helper.py"
IMAGE_FETCH = ROOT / "scripts" / "image_fetch.py"


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, *args], capture_output=True, text=True, cwd=ROOT)


class ScaffoldTest(unittest.TestCase):
    def scaffold_once(self, parent: Path) -> str:
        project = parent / "deck"
        project.mkdir()
        shutil.copy(EXAMPLE_PLAN, project / "deck.plan.json")
        result = run(str(HELPER), "scaffold", "--plan", str(project / "deck.plan.json"),
                      "--out", str(project / "deck.html"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return (project / "deck.html").read_text(encoding="utf-8")

    def test_scaffold_is_deterministic(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            self.assertEqual(self.scaffold_once(Path(a)), self.scaffold_once(Path(b)))

    def test_scaffold_output_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            html = self.scaffold_once(Path(tmp))
        self.assertIn('<meta name="nm-runtime" content="2">', html)
        self.assertIn('dir="rtl"', html)
        self.assertEqual(html.count('<section class="slide"'), 8)
        self.assertNotIn("class SlidePresentation", html)
        self.assertNotIn("cdn.tailwindcss.com", html)

    def test_scaffolded_deck_passes_audit(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.scaffold_once(Path(tmp))
            deck = Path(tmp) / "deck" / "deck.html"
            report = Path(tmp) / "audit.json"
            result = run(str(HELPER), "audit-deck", "--html-path", str(deck), "--output", str(report))
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertTrue(json.loads(report.read_text(encoding="utf-8"))["passed"])


class ShowcaseTest(unittest.TestCase):
    """The worked example must keep passing every static gate after it is copied out of the repository."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.project = Path(cls.tmp.name) / "showcase"
        shutil.copytree(SHOWCASE, cls.project, ignore=shutil.ignore_patterns("assets/fonts", "assets/nm", "*.bak"))
        for command in ("stage-fonts", "stage-runtime"):
            result = run(str(HELPER), command, "--target-dir", str(cls.project))
            assert result.returncode == 0, result.stdout + result.stderr

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_plan_lint(self):
        result = run(str(HELPER), "plan-lint", "--plan", str(self.project / "deck.plan.json"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_audit_outside_repository(self):
        report = self.project / "audit.json"
        result = run(str(HELPER), "audit-deck", "--html-path", str(self.project / "deck.html"), "--output", str(report))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(json.loads(report.read_text(encoding="utf-8"))["passed"])

    def test_deck_reads_nothing_outside_its_folder(self):
        html = (self.project / "deck.html").read_text(encoding="utf-8")
        self.assertNotIn('src="../', html)
        self.assertNotIn('href="../', html)

    def test_image_credits(self):
        result = run(str(IMAGE_FETCH), "credits", "--project", str(self.project), "--check", str(self.project / "deck.html"))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
