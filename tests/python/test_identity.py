"""Identity derived from the topic (roadmap NM-19): three palettes from the topic's own materials, contrast-checked,
different for different topics, never the stock cream-and-terracotta look by default."""
from __future__ import annotations

import itertools
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from _helpers import ROOT, codes, example_plan, load_deck_helper

dh = load_deck_helper()
ni = dh._identity()
HELPER = ROOT / "scripts" / "deck_helper.py"

TOPICS = {
    "brain": "كيف يتعلم الدماغ", "fall": "لماذا تسقط الأجسام معا؟", "ml": "Smaller models, same accuracy: distillation",
    "port": "كيف يرفع الميناء إنتاجيته", "palm": "زراعة النخيل في الواحة", "water": "دورة الماء في الطبيعة",
    "steel": "صناعة الصلب", "heart": "القلب والدورة الدموية", "grid": "شبكات الكهرباء الذكية", "finance": "التمويل والاستثمار",
}
CORPUS = [ROOT / "resources/templates/deck.plan.example.json"] + sorted((ROOT / "tests/corpus/plans").glob("*.plan.json"))


def derive(title: str, **theme) -> dict:
    return ni.derive({"title": title, "lang": "ar", "slides": [], "theme": theme})


class PaletteTest(unittest.TestCase):
    def test_every_palette_meets_the_contrast_targets(self):
        plans = [{"title": t, "slides": []} for t in TOPICS.values()] + [json.loads(p.read_text(encoding="utf-8")) for p in CORPUS]
        moods = [None, "calm", "energetic", "dark", "دافئ"]
        for plan, mood in itertools.product(plans, moods):
            plan = {**plan, "theme": {"derive": {"mood": mood} if mood else {}}}
            for pal in ni.derive(plan)["palettes"]:
                t = pal["tokens"]
                where = f"{plan['title']} {mood} {pal['kind']}"
                self.assertGreaterEqual(dh.contrast_ratio(t["ink"], t["paper"]), 7, where)
                self.assertGreaterEqual(dh.contrast_ratio(t["ink"], t["surface"]), 7, where)
                self.assertGreaterEqual(dh.contrast_ratio(t["muted"], t["paper"]), 4.5, where)
                self.assertGreaterEqual(dh.contrast_ratio(t["accent"], t["paper"]), 3, where)
                self.assertGreaterEqual(dh.contrast_ratio(t["accent2"], t["paper"]), 3, where)
                self.assertTrue(all(len(t[k]) == 7 and t[k].startswith("#") for k in ("paper", "ink", "muted", "line", "accent", "accent2", "surface")))

    def test_different_topics_get_different_accents(self):
        acc = {k: derive(t)["palettes"][0]["tokens"]["accent"] for k, t in TOPICS.items()}
        for a, b in itertools.combinations(acc, 2):
            self.assertGreater(ni.delta_e(acc[a], acc[b]), 20, f"{a} and {b}: {acc[a]} {acc[b]}")

    def test_the_stock_look_is_not_the_default(self):
        stock_paper, stock_accent = "#FAF7F0", "#B4441F"  # the `paper` preset: cream and terracotta
        for k, t in TOPICS.items():
            p = derive(t)["palettes"][0]["tokens"]
            self.assertFalse(ni.delta_e(p["paper"], stock_paper) < 3 and ni.delta_e(p["accent"], stock_accent) < 10, k)
        stub = dh.make_stub_plan("عرض", 6)
        self.assertIn("derive", stub["theme"], "plan-init starts from the topic, not from a preset")

    def test_materials_are_found_through_arabic_prefixes_and_plurals(self):
        found = ni.find_materials([("وبالموانئ تتحرك الحاويات عبر البحار", 1)])
        self.assertEqual({m["id"] for m in found}, {"container", "sea"})
        self.assertEqual([m["id"] for m in ni.find_materials([("A crane lifts containers from ships", 1)])], ["container"])

    def test_explicit_materials_and_mood_steer_the_result(self):
        r = derive("عنوان لا يذكر مادة", derive={"materials": ["نخيل", "ماء"], "mood": "ليلي"})
        self.assertEqual(r["source"], "explicit")
        self.assertEqual(r["lead"], ["palm", "water"])
        self.assertEqual(r["palettes"][0]["kind"], "dark")
        self.assertEqual(r["palettes"][0]["names"]["ar"]["accent"], "نخيل")

    def test_no_material_word_still_gives_a_stable_palette_and_a_lint_warning(self):
        a, b = derive("عرض عن موضوع ما"), derive("عرض عن موضوع آخر")
        self.assertEqual(a["source"], "title")
        self.assertEqual(a, derive("عرض عن موضوع ما"), "deterministic")
        self.assertNotEqual(a["palettes"][0]["tokens"]["accent"], b["palettes"][0]["tokens"]["accent"])
        plan = example_plan()
        plan["title"], plan["theme"] = "عرض", {"derive": {}}
        for s in plan["slides"]:
            s.get("text", {}).update(headline="عنوان", body=[], kicker="سطر")
            s.get("visual", {}).pop("query", None)
        self.assertIn("R130", codes(dh.lint_plan(plan), "warnings"))


class IntegrationTest(unittest.TestCase):
    def run_helper(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run([sys.executable, str(HELPER), *args], capture_output=True, text=True, env={"NM_FONTS_BUNDLED_ONLY": "1", "PATH": "/usr/bin:/bin"})

    def test_theme_derive_feeds_scaffold_and_explicit_tokens_still_win(self):
        plan = example_plan()
        plan["theme"] = {"derive": {"materials": ["دماغ"], "pick": 2}, "radius": 12}
        tokens, problems = dh.resolve_theme(plan["theme"], plan)
        self.assertEqual(problems, [])
        expected = ni.derive(plan)["palettes"][1]["tokens"]
        self.assertEqual(tokens["accent"], expected["accent"])
        self.assertEqual(tokens["radius"], 12)
        html, _, _ = dh.render_deck(plan, Path("/nonexistent"), font_files=[])
        self.assertIn(f"--nm-accent: {expected['accent']};", html)
        self.assertTrue(dh.lint_plan(plan)["passed"])

    def test_plans_with_a_preset_are_unchanged(self):
        self.assertEqual(dh.resolve_theme({"preset": "mist"}, example_plan()), dh.resolve_theme({"preset": "mist"}))

    def test_command_previews_and_apply(self):
        with tempfile.TemporaryDirectory() as tmp:
            plan = Path(tmp) / "deck.plan.json"
            plan.write_text((ROOT / "tests/corpus/plans/ar-advisor.plan.json").read_text(encoding="utf-8"), encoding="utf-8")
            r = self.run_helper("theme-derive", "--plan", str(plan), "--previews", str(Path(tmp) / "prev"), "--apply", "3")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn("حاويات الميناء", r.stdout)
            for s in "abc":
                self.assertTrue((Path(tmp) / "prev" / f"style-{s}.html").is_file())
            self.assertTrue((Path(tmp) / "prev/assets/nm/nm-deck.js").is_file())
            theme = json.loads(plan.read_text(encoding="utf-8"))["theme"]
            self.assertEqual(theme["derived"]["palette"], 3)
            self.assertTrue(dh.lint_plan(json.loads(plan.read_text(encoding="utf-8")))["passed"])
            self.assertTrue((Path(tmp) / "deck.plan.json.bak").is_file())


if __name__ == "__main__":
    unittest.main()
