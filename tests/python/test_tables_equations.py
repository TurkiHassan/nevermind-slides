"""Tables and equations in plans, scaffold, staging and audit (roadmap NM-10, NM-11)."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import ROOT, codes, example_plan, load_deck_helper

dh = load_deck_helper()
BUNDLED = [name for _f, name, _x, _w in dh.FONT_CATALOGUE if (dh.FONTS_SOURCE_DIR / name).exists()]
HELPER = ROOT / "scripts" / "deck_helper.py"
AR_SCIENCE = ROOT / "tests" / "corpus" / "plans" / "ar-science.plan.json"
EN_SCIENCE = ROOT / "tests" / "corpus" / "plans" / "en-science.plan.json"


def render(plan: dict) -> str:
    html, _, _ = dh.render_deck(plan, Path("/nonexistent"), font_files=BUNDLED)
    return html


def with_visual(visual: dict, steps: list | None = None) -> dict:
    plan = example_plan()
    slide = plan["slides"][2]
    slide["visual"] = visual
    slide["steps"] = steps or []
    return plan


TABLE = {"type": "table", "columns": ["البند", "القيمة", "النسبة"], "rows": [["أ", 12, "40٪"], ["ب", 7.5, "25٪"]]}


class PlanLintTest(unittest.TestCase):
    def test_science_plans_pass(self):
        for path in (AR_SCIENCE, EN_SCIENCE):
            report = dh.lint_plan(json.loads(path.read_text(encoding="utf-8")))
            self.assertTrue(report["passed"], (path.name, report["errors"]))
            self.assertEqual(report["warnings"], [], path.name)

    def test_table_structure(self):
        self.assertTrue(dh.lint_plan(with_visual(TABLE))["passed"])
        ragged = dict(TABLE, rows=[["أ", 1, 2], ["ب", 3]])
        self.assertIn("R125", codes(dh.lint_plan(with_visual(ragged))))
        self.assertIn("R125", codes(dh.lint_plan(with_visual({"type": "table", "rows": [["أ"]]}))))
        self.assertIn("R125", codes(dh.lint_plan(with_visual(dict(TABLE, highlight="r9")))))
        self.assertIn("R125", codes(dh.lint_plan(with_visual(dict(TABLE, highlight="row2")))))
        self.assertNotIn("R125", codes(dh.lint_plan(with_visual(dict(TABLE, highlight="r2 c2")))))
        big = dict(TABLE, columns=["a", "b", "c"], rows=[["x", 1, 2]] * 9)
        self.assertIn("R126", codes(dh.lint_plan(with_visual(big)), "warnings"))

    def test_equation_sources(self):
        ok_m = {"type": "equation", "mathml": "<math><mi>x</mi></math>"}
        ok_t = {"type": "equation", "tex": "x^2"}
        for v in (ok_m, ok_t, {"type": "equation", "lines": [{"tex": "a"}, {"mathml": "<math><mi>b</mi></math>", "note": "ن"}]}):
            self.assertTrue(dh.lint_plan(with_visual(v))["passed"], v)
        self.assertIn("R127", codes(dh.lint_plan(with_visual({"type": "equation"}))))
        self.assertIn("R127", codes(dh.lint_plan(with_visual({"type": "equation", "tex": "x", "mathml": "<math></math>"}))))
        self.assertIn("R127", codes(dh.lint_plan(with_visual({"type": "equation", "mathml": "<mi>x</mi>"}))))
        self.assertIn("R127", codes(dh.lint_plan(with_visual({"type": "equation", "mathml": '<math><mi onclick="x()">x</mi></math>'}))))
        self.assertIn("R127", codes(dh.lint_plan(with_visual({"type": "equation", "lines": []}))))
        self.assertIn("R128", codes(dh.lint_plan(with_visual({"type": "equation", "tex": "$x^2$"}))))
        five = {"type": "equation", "lines": [{"tex": "a"}] * 5}
        self.assertIn("R129", codes(dh.lint_plan(with_visual(five)), "warnings"))

    def test_formula_digits_do_not_decide_or_mix_the_deck_digit_system(self):
        plan = with_visual({"type": "equation", "mathml": "<math><msup><mi>x</mi><mn>2</mn></msup></math>"})
        arabic = json.loads(json.dumps(plan, ensure_ascii=False).replace("70%", "٧٠٪"))  # the example's only Western digits
        self.assertEqual(dh._plan_uses_arabic_digits(arabic), True, "the formula's 2 does not switch the deck to Western digits")
        self.assertNotIn("R121", codes(dh.lint_plan(arabic), "warnings"))
        arabic["slides"][1]["text"]["body"] = ["العلاقة \\(x^2 + 1\\) بسيطة"]
        self.assertTrue(dh._plan_uses_arabic_digits(arabic))
        self.assertNotIn("R121", codes(dh.lint_plan(arabic), "warnings"))


class ScaffoldTest(unittest.TestCase):
    def test_decks_without_tables_or_formulas_link_exactly_what_they_did(self):
        html = render(example_plan())
        for name in ("nm-table", "nm-math", "temml"):
            self.assertNotIn(name, html)

    def test_table_markup_and_steps(self):
        html = render(with_visual(dict(TABLE, highlight="r1", caption="المصدر"), [{"act": "highlight", "target": "visual:col"}]))
        self.assertIn('<link rel="stylesheet" href="assets/nm/nm-table.css">', html)
        self.assertIn('<script src="assets/nm/nm-table.js"></script>', html)
        self.assertNotIn("nm-math", html)
        self.assertIn('data-highlight="r1" data-morph="visual" data-steps="col" data-step-from="1" data-steps-act="highlight"', html)
        self.assertIn('<th scope="col">البند</th>', html)
        self.assertIn('<tr><th scope="row">أ</th><td>12</td><td>40٪</td></tr>', html)  # the example plan writes Western digits
        self.assertIn("<td>7.5</td>", html)
        self.assertIn("<figcaption>المصدر</figcaption>", html)
        self.assertNotIn('data-step="', html.split('class="nm-table"')[1].split("</figure>")[0])

    def test_plan_numbers_follow_the_deck_digit_system(self):
        saved = dict(dh._SCAFFOLD)
        try:
            dh._SCAFFOLD.update(lang="ar", arabic_digits=True)
            self.assertEqual((dh._cell(7.5), dh._cell(12), dh._cell("12")), ("٧٫٥", "١٢", "12"))  # text cells stay as written
            dh._SCAFFOLD.update(arabic_digits=False)
            self.assertEqual(dh._cell(7.5), "7.5")
        finally:
            dh._SCAFFOLD.update(saved)

    def test_row_steps_count_body_rows(self):
        plan = with_visual(TABLE, [{"act": "reveal", "target": "visual:row"}, {"act": "reveal", "target": "kicker"}])
        steps = dh._plan_steps(plan["slides"][2])
        self.assertEqual(steps["table"], {"mode": "row", "start": 1, "act": "reveal"})
        self.assertEqual(steps["elements"]["kicker"][0], 3)  # after the two row steps

    def test_derivation_keeps_the_first_line_and_steps_the_rest(self):
        lines = [{"mathml": "<math><mi>a</mi></math>"}, {"tex": "b", "note": "خطوة"}, {"tex": "c"}]
        html = render(with_visual({"type": "equation", "lines": lines}, [{"act": "reveal", "target": "visual:line"}]))
        fig = html.split('class="nm-equation"')[1].split("</figure>")[0]
        self.assertIn('<div class="nm-eq-line"><math display="block"><mi>a</mi></math></div>', fig)
        self.assertIn('<div class="nm-eq-line" data-step="1" data-act="reveal"><span class="nm-math" data-display="block" data-tex="b"></span><p class="nm-eq-note">خطوة</p></div>', fig)
        self.assertIn('data-step="2"', fig)
        self.assertNotIn('data-step="3"', fig)
        self.assertIn('<script src="assets/nm/vendor/temml.min.js"></script>\n<script src="assets/nm/nm-math.js"></script>', html)

    def test_mathml_only_needs_no_converter(self):
        html = render(with_visual({"type": "equation", "mathml": '<math display="inline"><mi>E</mi></math>'}))
        self.assertIn('<link rel="stylesheet" href="assets/nm/nm-math.css">', html)
        self.assertIn('<script src="assets/nm/nm-math.js"></script>', html)
        self.assertNotIn("temml", html)
        self.assertIn('<math display="inline"><mi>E</mi></math>', html)  # an explicit display is kept

    def test_inline_tex_in_arabic_text(self):
        plan = example_plan()
        plan["slides"][1]["text"]["body"] = ["نعكس العلاقة \\(d = \\tfrac{1}{2} g t^2\\) فنحصل على الزمن"]
        html = render(plan)
        self.assertIn('نعكس العلاقة <span class="nm-math" data-tex="d = \\tfrac{1}{2} g t^2"></span> فنحصل على الزمن', html)
        self.assertIn("vendor/temml.min.js", html)


class StagingAndAuditTest(unittest.TestCase):
    def run_helper(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(HELPER), *args], capture_output=True, text=True, env={"NM_FONTS_BUNDLED_ONLY": "1", "PATH": "/usr/bin:/bin"})

    def test_stage_runtime_math_is_opt_in(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(self.run_helper("stage-runtime", "--target-dir", tmp).returncode, 0)
            self.assertTrue((Path(tmp) / "assets/nm/nm-table.js").is_file())
            self.assertFalse((Path(tmp) / "assets/nm/vendor").exists())
            self.assertEqual(self.run_helper("stage-runtime", "--target-dir", tmp, "--math").returncode, 0)
            self.assertTrue((Path(tmp) / "assets/nm/vendor/temml.min.js").is_file())
            self.assertTrue((Path(tmp) / "assets/nm/vendor/temml.LICENSE.txt").is_file())

    def test_science_decks_pass_the_audit_and_a_missing_converter_fails_it(self):
        with tempfile.TemporaryDirectory() as tmp:
            for plan in (AR_SCIENCE, EN_SCIENCE):
                project = Path(tmp) / plan.stem
                project.mkdir()
                (project / "deck.plan.json").write_text(plan.read_text(encoding="utf-8"), encoding="utf-8")
                r = self.run_helper("scaffold", "--plan", str(project / "deck.plan.json"), "--out", str(project / "deck.html"))
                self.assertEqual(r.returncode, 0, r.stderr)
                self.assertIn("Temml", r.stdout)
                out = project / "audit.json"
                self.assertEqual(self.run_helper("audit-deck", "--html-path", str(project / "deck.html"), "--output", str(out)).returncode, 0)
                report = json.loads(out.read_text(encoding="utf-8"))
                self.assertGreaterEqual(report["contract"]["tables"], 1)
                self.assertFalse(any("words of text" in w for w in report["warnings"]), "table cells are not prose")
            deck = Path(tmp) / "en-science.plan" / "deck.html"
            deck.write_text(deck.read_text(encoding="utf-8").replace('<script src="assets/nm/vendor/temml.min.js"></script>\n', ""), encoding="utf-8")
            out = Path(tmp) / "audit2.json"
            self.assertEqual(self.run_helper("audit-deck", "--html-path", str(deck), "--output", str(out)).returncode, 1)
            self.assertTrue(any("stage-runtime --math" in e for e in json.loads(out.read_text(encoding="utf-8"))["errors"]))

    def test_audit_checks_table_vocabulary(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            plan = with_visual(TABLE, [{"act": "reveal", "target": "visual:row"}])
            (project / "deck.plan.json").write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
            self.assertEqual(self.run_helper("scaffold", "--plan", str(project / "deck.plan.json"), "--out", str(project / "deck.html")).returncode, 0)
            deck = project / "deck.html"
            deck.write_text(deck.read_text(encoding="utf-8").replace('data-steps="row"', 'data-steps="rows"'), encoding="utf-8")
            out = project / "audit.json"
            self.run_helper("audit-deck", "--html-path", str(deck), "--output", str(out))
            errors = json.loads(out.read_text(encoding="utf-8"))["errors"]
            self.assertTrue(any('data-steps="rows"' in e and '"row"' in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
