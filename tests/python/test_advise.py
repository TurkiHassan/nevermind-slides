"""Representation intelligence (roadmap NM-29, section 16.7): fit, not beauty.

tests/advice/cases.json was written before the rules (commit 85bd181); tests/advice/holdout.json after they were
frozen (2a93190) and measured once (22/24, see IMPROVEMENT_ROADMAP.md section 21) before two coverage gaps were closed.
"""
from __future__ import annotations

import copy
import itertools
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import ROOT, codes, example_plan, load_deck_helper

dh = load_deck_helper()
nr = dh._represent()
HELPER = ROOT / "scripts" / "deck_helper.py"
CASES = json.loads((ROOT / "tests" / "advice" / "cases.json").read_text(encoding="utf-8"))
HOLDOUT = json.loads((ROOT / "tests" / "advice" / "holdout.json").read_text(encoding="utf-8"))
ADVISOR_PLAN = ROOT / "tests" / "corpus" / "plans" / "ar-advisor.plan.json"


def ranked(case: dict) -> list[str]:
    f = nr.features(case["slide"], {"audience": case.get("audience", "general")})
    return [r["visual"] for r in nr.rank(f)]


def slide(kind: str, **content) -> dict:
    return {"role": "concept", "rel": "next", "content": {"kind": kind, **content}}


class AccuracyTest(unittest.TestCase):
    def rates(self, cases: list[dict]) -> tuple[float, float]:
        top1 = sum(1 for c in cases if (r := ranked(c)) and r[0] in c["accept"])
        top3 = sum(1 for c in cases if any(v in c["accept"] for v in ranked(c)[:3]))
        return top1 / len(cases), top3 / len(cases)

    def test_first_suggestion_and_first_three(self):
        top1, top3 = self.rates(CASES["cases"])
        self.assertEqual(len(CASES["cases"]), 60)
        self.assertGreaterEqual(top1, 0.85)
        self.assertGreaterEqual(top3, 0.95)

    def test_holdout_still_holds(self):
        top1, top3 = self.rates(HOLDOUT["cases"])
        self.assertGreaterEqual(top1, 0.85)
        self.assertGreaterEqual(top3, 0.95)

    def test_every_described_slide_gets_a_suggestion(self):
        """Coverage invariant (the hold-out misses were empty suggestions): any kind with any shape of data."""
        shapes = [
            {}, {"items": 1}, {"items": 4}, {"items": 12}, {"sequence": "ordered", "items": 5}, {"sequence": "cyclic", "items": 4},
            {"entities": ["a", "b", "c"]}, {"formula": True}, {"dimensions": {"options": 2}}, {"dimensions": {"options": 3, "criteria": 4}},
            {"quantities": [{"label": "a", "value": 5}]}, {"quantities": [{"label": "a", "value": 60, "unit": "%"}, {"label": "b", "value": 40, "unit": "%"}]},
            {"quantities": [{"label": str(y), "value": v} for y, v in zip(range(2020, 2025), range(5))], "sequence": "ordered"},
            {"quantities": [{"label": "a", "value": 1, "unit": "s"}, {"label": "b", "value": 2, "unit": "m"}]},
            {"quantities": [{"label": f"x{i}", "value": i} for i in range(10)]},
        ]
        for kind, shape in itertools.product(nr.KINDS, shapes):
            for audience in ("general", "expert"):
                f = nr.features(slide(kind, **shape), {"audience": audience})
                self.assertTrue(nr.rank(f), f"{kind} {shape} {audience}: no suggestion")


class NeverTest(unittest.TestCase):
    def check(self, f: dict, recs: list[str], where: str) -> None:
        if "chart:donut" in recs:
            self.assertTrue(f["sum100"], f"{where}: donut without parts of 100")
        if any(r.startswith("chart:") for r in recs):
            self.assertGreaterEqual(f["quantities"], 1, f"{where}: chart without numbers")
        if "equation" in recs:
            self.assertTrue(f["formula"], f"{where}: equation without a formula")
        if "chart:line" in recs:
            self.assertTrue(f["time_series"], f"{where}: line without a series")
        if "chart:bars" in recs:
            self.assertGreaterEqual(f["quantities"], 2, f"{where}: bars without two values")

    def test_never_rules_hold_on_every_case_and_on_a_grid(self):
        for case in CASES["cases"] + HOLDOUT["cases"]:
            f = nr.features(case["slide"], {"audience": case.get("audience", "general")})
            self.check(f, [r["visual"] for r in nr.rank(f)], case["id"])
        qsets = [[], [{"label": "a", "value": 3}], [{"label": "a", "value": 30, "unit": "%"}, {"label": "b", "value": 50, "unit": "%"}],
                 [{"label": "a", "value": 1}, {"label": "b", "value": 2}, {"label": "c", "value": 3}]]
        for kind, qs, seq, dims in itertools.product(nr.KINDS, qsets, (None, "ordered"), ({}, {"options": 2, "criteria": 3})):
            content = {"quantities": qs, "dimensions": dims}
            if seq:
                content["sequence"] = seq
            f = nr.features(slide(kind, **content))
            self.check(f, [r["visual"] for r in nr.rank(f)], f"{kind} {qs} {seq} {dims}")


class ExplanationTest(unittest.TestCase):
    def test_every_rule_and_code_is_explained_in_both_languages(self):
        r = nr.rules()
        for item in r["rules"] + r["never"] + r["codes"]:
            self.assertTrue(item["ar"].strip() and item["en"].strip(), item["id"])
        ids = [x["id"] for x in r["rules"] + r["codes"]]
        self.assertEqual(len(ids), len(set(ids)), "rule and code ids are unique")
        for rule in r["rules"]:
            for rep in rule["suggest"]:
                self.assertIn(rep, r["representations"], f"{rule['id']} suggests an unknown representation {rep}")

    def test_every_suggestion_carries_its_reason_with_no_placeholder_left(self):
        for case in CASES["cases"] + HOLDOUT["cases"]:
            plan = {"lang": case["lang"], "audience": case.get("audience", "general"), "slides": [dict(case["slide"], id="s1")]}
            entry = nr.advise_plan(plan)["slides"][0]
            for rec in entry["recommend"]:
                self.assertTrue(rec["why"], case["id"])
                for text in (rec["text_ar"], rec["text_en"]):
                    self.assertNotIn("{", text, case["id"])
            for act in entry["acts"]:
                self.assertNotIn("{", act["text_ar"] + act["text_en"], case["id"])

    def test_arabic_reasons_use_arabic_digits(self):
        plan = {"lang": "ar", "slides": [dict(slide("comparison", dimensions={"options": 2, "criteria": 4}), id="s1")]}
        text = nr.advise_plan(plan)["slides"][0]["recommend"][0]["text_ar"]
        self.assertIn("٤", text)
        self.assertNotRegex(text, r"[0-9]")


class NarrativeTest(unittest.TestCase):
    def test_deeper_suggests_lens_detail_or_zoom(self):
        for kind in ("concept", "process", "causal", "data", "hierarchy", "part-whole", "comparison"):
            content = {"items": 4, "entities": ["a", "b", "c"]} if kind != "data" else {"quantities": [{"label": "a", "value": 1}, {"label": "b", "value": 3}, {"label": "c", "value": 2}]}
            s = dict(slide(kind, **content), rel="deeper")
            f = nr.features(s)
            acts, still = nr.acts_for(f, nr.rank(f)[0]["visual"], None)
            self.assertFalse(still, kind)
            self.assertIn(acts[0]["act"], ("lens", "detail", "zoom"), kind)

    def test_a_shared_entity_suggests_morph(self):
        plan = {"lang": "en", "slides": [
            dict(slide("process", items=4, sequence="ordered", entities=["crane", "truck"]), id="a"),
            dict(slide("part-whole", items=3, entities=["crane"]), id="b")]}
        advice = nr.advise_plan(plan)
        self.assertEqual(advice["slides"][0]["morph"], [])
        self.assertEqual(advice["slides"][1]["morph"][0]["entities"], ["crane"])
        self.assertEqual(advice["slides"][1]["morph"][0]["why"], ["A302"])

    def test_still_slides_get_no_steps(self):
        for s in (slide("definition"), dict(slide("argument", items=1), role="quote"),
                  slide("finding", quantities=[{"label": "x", "value": 70, "unit": "%"}]), dict(slide("concept", items=2), rel="deeper")):
            f = nr.features(s)
            acts, still = nr.acts_for(f, nr.rank(f)[0]["visual"], None)
            self.assertTrue(still, s)
            self.assertEqual(acts, [], s)

    def test_flat_slide_note_spares_still_slides_only_with_the_advisor(self):
        plan = json.loads(ADVISOR_PLAN.read_text(encoding="utf-8"))
        with_advisor = dh.lint_plan(plan)["motion_summary"]["flat_slides"]
        plan.pop("advisor")
        without = dh.lint_plan(plan)["motion_summary"]["flat_slides"]
        self.assertIn(3, without)  # a definition, typography alone
        self.assertNotIn(3, with_advisor)
        self.assertIn(5, with_advisor, "a slide that is not still keeps its note")


class RepetitionTest(unittest.TestCase):
    def deck(self, kinds: list[str], morph: bool) -> dict:
        slides = []
        for i, k in enumerate(kinds):
            s = {"id": f"s{i + 1}", "role": "concept", "layout": "split", "rel": "next", "visual": {"type": "chart", "diagram_type": "bars"},
                 "morph": ["visual"] if morph else [], "steps": [], "content": {"kind": k, "items": 4}}
            slides.append(s)
        return {"lang": "en", "slides": slides}

    def test_same_look_for_different_information_warns(self):
        rep = nr.advise_plan(self.deck(["comparison", "data", "process"], morph=True))["repetition"]
        self.assertEqual([(r["code"], r["slides"]) for r in rep], [("A401", [1, 2, 3])])

    def test_an_intentional_series_linked_by_morph_does_not(self):
        self.assertEqual(nr.advise_plan(self.deck(["data", "data", "data", "data"], morph=True))["repetition"], [])

    def test_same_information_with_no_narrative_link_warns(self):
        rep = nr.advise_plan(self.deck(["data", "data", "data"], morph=False))["repetition"]
        self.assertEqual([r["code"] for r in rep], ["A402"])


class ToolsTest(unittest.TestCase):
    def run_helper(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(HELPER), *args], capture_output=True, text=True, env={"NM_FONTS_BUNDLED_ONLY": "1", "PATH": "/usr/bin:/bin"})

    def test_deterministic(self):
        plan = json.loads(ADVISOR_PLAN.read_text(encoding="utf-8"))
        self.assertEqual(nr.advice_json(nr.advise_plan(plan)), nr.advice_json(nr.advise_plan(copy.deepcopy(plan))))
        with tempfile.TemporaryDirectory() as tmp:
            outs = []
            for n in range(2):
                out = Path(tmp) / f"advice{n}.json"
                self.assertEqual(self.run_helper("plan-advise", "--plan", str(ADVISOR_PLAN), "--output", str(out)).returncode, 0)
                outs.append(out.read_bytes())
            self.assertEqual(outs[0], outs[1])

    def test_plans_without_the_new_fields_get_no_new_codes(self):
        report = dh.lint_plan(example_plan())
        self.assertFalse([c for c in codes(report, "warnings") | codes(report) if c.startswith("A")])
        self.assertFalse(dh._has_content(example_plan()))
        plan = example_plan()
        plan["advisor"] = True  # advisor on, nothing described: only the hint to describe
        self.assertTrue(codes(dh.lint_plan(plan), "warnings") <= {"A200", "R105"})
        self.assertEqual(codes(dh.lint_plan(plan)), codes(dh.lint_plan(example_plan())), "never a new error")

    def test_lint_reports_poor_fit_and_data_problems_as_warnings(self):
        plan = json.loads(ADVISOR_PLAN.read_text(encoding="utf-8"))
        plan["slides"][6]["visual"] = {"type": "chart", "diagram_type": "bars"}
        plan["slides"][4]["content"]["quantities"][3]["value"] = 5
        report = dh.lint_plan(plan)
        self.assertTrue(report["passed"])
        self.assertIn("A290", codes(report, "warnings"))
        self.assertIn("A501", codes(report, "warnings"))
        on7 = lambda r: [w["code"] for w in r["warnings"] if w["slide"] == 7]
        self.assertIn("A290", on7(report))
        plan["slides"][6]["visual"]["locked"] = True
        self.assertNotIn("A290", on7(dh.lint_plan(plan)))

    def test_apply_writes_only_what_scaffold_can_build_and_never_breaks_the_plan(self):
        plan = json.loads(ADVISOR_PLAN.read_text(encoding="utf-8"))
        plan["slides"][3]["visual"] = {"type": "chart", "diagram_type": "bars", "ref": "route"}  # a process as bars: poor
        plan["slides"][6]["visual"] = {"type": "chart", "diagram_type": "bars"}  # a qualitative comparison: needs data for a table
        plan["slides"][5]["visual"] = {"type": "chart", "diagram_type": "donut", "locked": True}  # locked, even if poor
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "deck.plan.json"
            path.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
            r = self.run_helper("plan-advise", "--plan", str(path), "--apply")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("applied  s4: chart:bars -> diagram:flow (A220)", r.stdout)
            self.assertIn("skipped  s7: table needs the values", r.stdout)
            new = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(new["slides"][3]["visual"]["diagram_type"], "flow")
            self.assertIn("خطوات بترتيب", new["slides"][3]["visual"]["why"])
            self.assertEqual(new["slides"][5]["visual"], plan["slides"][5]["visual"])
            self.assertEqual(new["slides"][6]["visual"], plan["slides"][6]["visual"])
            self.assertTrue(path.with_name("deck.plan.json.bak").is_file())
            self.assertTrue(dh.lint_plan(new)["passed"])

    def test_apply_builds_a_table_from_quantities_and_an_equation_from_the_formula(self):
        plan = {"lang": "en", "slides": [
            dict(slide("data", quantities=[{"label": f"m{i}", "value": i, "unit": "ms"} for i in range(9)]), id="a", visual={"type": "chart", "diagram_type": "donut"}),
            dict(slide("concept", formula="E = mc^2"), id="b", visual={"type": "none"})]}
        new, applied, skipped = nr.apply_advice(plan, nr.advise_plan(plan))
        self.assertEqual(new["slides"][0]["visual"]["type"], "table")
        self.assertEqual(new["slides"][0]["visual"]["columns"], ["", "ms"])
        self.assertEqual(len(new["slides"][0]["visual"]["rows"]), 9)
        self.assertEqual(new["slides"][1]["visual"]["tex"], "E = mc^2")
        self.assertEqual(skipped, [])

    def test_plan_init_advisor(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(self.run_helper("plan-init", "--target-dir", tmp, "--title", "عرض", "--slides", "6", "--advisor").returncode, 0)
            plan = json.loads((Path(tmp) / "deck.plan.json").read_text(encoding="utf-8"))
            self.assertTrue(plan["advisor"])
            self.assertEqual([("content" in s) for s in plan["slides"]], [False, True, True, True, True, False])
            self.assertTrue(dh.lint_plan(plan)["passed"])

    def test_scaffold_draws_charts_from_the_plan_numbers_and_explains_each_representation(self):
        html, _, _ = dh.render_deck(json.loads(ADVISOR_PLAN.read_text(encoding="utf-8")), Path("/nonexistent"),
                                    font_files=[n for _f, n, _x, _w in dh.FONT_CATALOGUE if (dh.FONTS_SOURCE_DIR / n).exists()])
        self.assertIn("x: 2021, 2022, 2023, 2024, 2025\n      series الاتجاه: 22, 24, 27, 29, 31", html)
        self.assertIn("انتظار الشاحنات: 45 !", html)
        self.assertNotIn('data-id="lost-time" aria-label="الوقت الضائع" data-nm-todo', html)
        self.assertIn("representation: chart:donut (good; A212:", html)
        self.assertIn("keep this slide still", html)
        self.assertIn("n4[العنصر الرابع]", html)  # four starter nodes for a four-step process

    def test_scaffold_numbers_follow_arabic_digits(self):
        plan = json.loads(ADVISOR_PLAN.read_text(encoding="utf-8"))
        ar = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")

        def arabic(node):  # every visible string in Arabic-Indic digits; JSON numbers stay numbers
            if isinstance(node, dict):
                return {k: (v if k in ("id", "ref", "target", "morph", "layout") else arabic(v)) for k, v in node.items()}
            if isinstance(node, list):
                return [arabic(v) for v in node]
            return node.translate(ar) if isinstance(node, str) else node
        plan = arabic(plan)
        self.assertTrue(dh._plan_uses_arabic_digits(plan), "numbers in content.quantities do not switch the deck to Western digits")
        html, _, _ = dh.render_deck(plan, Path("/nonexistent"), font_files=[])
        self.assertIn("انتظار الشاحنات: ٤٥ !", html)
        self.assertIn("x: ٢٠٢١, ٢٠٢٢", html)

    def test_audit_compares_the_drawn_chart_with_the_plan(self):
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp)
            (project / "deck.plan.json").write_text(ADVISOR_PLAN.read_text(encoding="utf-8"), encoding="utf-8")
            self.assertEqual(self.run_helper("scaffold", "--plan", str(project / "deck.plan.json"), "--out", str(project / "deck.html")).returncode, 0)
            out = project / "audit.json"
            self.run_helper("audit-deck", "--html-path", str(project / "deck.html"), "--output", str(out))
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["contract"]["plan_data"], [])
            deck = project / "deck.html"
            deck.write_text(deck.read_text(encoding="utf-8").replace("      أخرى: 10\n", "").replace("الأعطال: 15", "الأعطال: 20"), encoding="utf-8")
            self.run_helper("audit-deck", "--html-path", str(deck), "--output", str(out))
            issues = json.loads(out.read_text(encoding="utf-8"))["contract"]["plan_data"]
            self.assertTrue(any("draws 3 values" in i and "lists 4" in i for i in issues), issues)
            self.assertTrue(any("add up to 95, not 100" in i for i in issues), issues)


if __name__ == "__main__":
    unittest.main()
