"""One positive and one negative case for every plan-lint rule (references/deck-plan.md)."""
from __future__ import annotations

import unittest

from _helpers import codes, example_plan, load_deck_helper

dh = load_deck_helper()


def stub_slides(n: int) -> list[dict]:
    """n linked slides that pass every rule: cover ... closing, each sharing the title morph."""
    layouts = ["cover", "split", "cards", "split-rev", "list", "compare", "split", "cards"]
    slides = []
    for i in range(n):
        role = "cover" if i == 0 else ("closing" if i == n - 1 else "concept")
        slides.append({
            "id": f"s{i + 1}", "title": f"شريحة {i + 1}", "role": role,
            "layout": layouts[i % len(layouts)] if 0 < i < n - 1 else ("cover" if i == 0 else "center"),
            "visual": {"type": "diagram", "diagram_type": "flow", "ref": f"d{i + 1}"},
            "rel": "next", "transition": "auto", "morph": ["title"],
            "steps": [{"act": "focus", "target": "visual"}] if i == 1 else [],
            "text": {"headline": "عنوان قصير", "body": ["نقطة واحدة"]},
        })
    return slides


class BaselineTest(unittest.TestCase):
    def test_example_plan_passes(self):
        report = dh.lint_plan(example_plan())
        self.assertTrue(report["passed"], report["errors"])

    def test_stub_plan_passes(self):
        report = dh.lint_plan({"title": "اختبار", "slides": stub_slides(8)})
        self.assertTrue(report["passed"], report["errors"])

    def test_motion_summary_present(self):
        report = dh.lint_plan(example_plan())
        self.assertIn("average", report["motion_summary"])
        self.assertEqual(len(report["slides"]), 8)


class StructureRulesTest(unittest.TestCase):
    def lint(self, plan):
        return dh.lint_plan(plan)

    def test_p001_not_an_object(self):
        self.assertIn("P001", codes(self.lint([])))

    def test_p001_missing_title(self):
        plan = example_plan()
        plan["title"] = ""
        self.assertIn("P001", codes(self.lint(plan)))

    def test_p002_bad_mode(self):
        plan = example_plan()
        plan["mode"] = "wild"
        self.assertIn("P002", codes(self.lint(plan)))

    def test_p002_lang(self):
        # NM-09: Arabic and English decks; anything else is refused with the list of choices.
        plan = example_plan()
        plan["lang"] = "en"
        self.assertNotIn("P002", codes(self.lint(plan)))
        plan["lang"] = "fr"
        self.assertIn("P002", codes(self.lint(plan)))

    def test_p002_bad_act(self):
        plan = example_plan()
        plan["slides"][2]["steps"][0]["act"] = "explode"
        self.assertIn("P002", codes(self.lint(plan)))

    def test_p003_bad_theme(self):
        plan = example_plan()
        plan["theme"] = {"preset": "no-such-theme"}
        self.assertIn("P003", codes(self.lint(plan)))

    def test_p004_duplicate_id(self):
        plan = example_plan()
        plan["slides"][1]["id"] = plan["slides"][0]["id"]
        self.assertIn("P004", codes(self.lint(plan)))

    def test_p005_unknown_layout(self):
        plan = example_plan()
        plan["slides"][1]["layout"] = "no-such-layout"
        self.assertIn("P005", codes(self.lint(plan)))

    def test_r101_first_slide_cover(self):
        plan = example_plan()
        plan["slides"][0]["role"] = "concept"
        self.assertIn("R101", codes(self.lint(plan)))

    def test_r102_last_slide_closing(self):
        plan = example_plan()
        plan["slides"][-1]["role"] = "concept"
        self.assertIn("R102", codes(self.lint(plan)))

    def test_r103_slide_count(self):
        self.assertIn("R103", codes(self.lint({"title": "t", "slides": stub_slides(4)})))
        self.assertIn("R103", codes(self.lint({"title": "t", "slides": stub_slides(25)})))
        self.assertNotIn("R103", codes(self.lint({"title": "t", "slides": stub_slides(5)})))


class DesignRulesTest(unittest.TestCase):
    def lint(self, plan):
        return dh.lint_plan(plan)

    def test_r104_r105_layout_repetition(self):
        """R104/R105 compare what slides look like (decision D9), not the layout names."""
        slides = stub_slides(8)
        slides[1]["steps"] = []
        for k in (2, 3):
            slides[k]["layout"] = "split"
        slides[1]["layout"] = "cards"
        report = self.lint({"title": "t", "slides": slides})
        self.assertIn("R105", codes(report, "warnings"))
        self.assertNotIn("R104", codes(report))
        # a different name for the same composition still counts
        slides[1]["layout"] = "split-rev"
        self.assertIn("R104", codes(self.lint({"title": "t", "slides": slides})))
        # the same name with a different visual, number of points or acts does not
        for change in (
            lambda s: s.__setitem__("visual", {"type": "chart", "chart_type": "bar", "ref": "c"}),
            lambda s: s["text"].__setitem__("body", ["أ", "ب", "ج", "د"]),
            lambda s: s.__setitem__("steps", [{"act": "focus", "target": "visual"}]),
        ):
            varied = [dict(x, text=dict(x["text"])) for x in slides]
            change(varied[2])
            self.assertNotIn("R104", codes(self.lint({"title": "t", "slides": varied})))
        # a series carried by a shared visual is intentional
        for k in (1, 2, 3):
            slides[k]["morph"] = ["title", "flow"]
        report = self.lint({"title": "t", "slides": slides})
        self.assertNotIn("R104", codes(report))
        self.assertNotIn("R105", codes(report))

    def test_r106_unlinked_slide(self):
        slides = stub_slides(6)
        slides[2]["morph"] = []
        slides[1]["morph"] = []
        slides[3]["morph"] = []
        self.assertIn("R106", codes(self.lint({"title": "t", "slides": slides})))
        slides[2]["rel"] = "contrast"
        self.assertNotIn("R106", {e["code"] for e in self.lint({"title": "t", "slides": slides})["errors"] if e["slide"] == 3})

    def test_r107_orphan_morph(self):
        slides = stub_slides(6)
        slides[3]["morph"] = ["title", "lonely"]
        self.assertIn("R107", codes(self.lint({"title": "t", "slides": slides})))

    def test_r108_two_heavy_acts(self):
        slides = stub_slides(6)
        slides[2]["steps"] = [{"act": "detail"}, {"act": "lens"}]
        self.assertIn("R108", codes(self.lint({"title": "t", "slides": slides})))

    def test_r109_r110_step_counts(self):
        slides = stub_slides(6)
        slides[2]["steps"] = [{"act": "reveal", "target": f"body{k}"} for k in range(5)]
        report = self.lint({"title": "t", "slides": slides})
        self.assertIn("R110", codes(report, "warnings"))
        self.assertNotIn("R109", codes(report))
        slides[2]["steps"] = [{"act": "reveal", "target": f"body{k}"} for k in range(7)]
        self.assertIn("R109", codes(self.lint({"title": "t", "slides": slides})))

    def test_r111_isolation_needed(self):
        slides = stub_slides(8)
        slides[1]["steps"] = []
        self.assertIn("R111", codes(self.lint({"title": "t", "slides": slides})))
        self.assertNotIn("R111", codes(self.lint({"title": "t", "slides": stub_slides(8)})))

    def test_r112_evidence_needs_diagram(self):
        slides = stub_slides(6)
        for s in slides:
            s["visual"] = {"type": "image", "ref": "x", "query": "x"}
        slides[2]["role"] = "evidence"
        report = self.lint({"title": "t", "image_source": "web", "slides": slides})
        self.assertIn("R112", codes(report))

    def test_r113_two_empty_visuals(self):
        slides = stub_slides(6)
        slides[2]["visual"] = {"type": "none"}
        slides[3]["visual"] = {"type": "none"}
        self.assertIn("R113", codes(self.lint({"title": "t", "slides": slides})))

    def test_r114_headline_length(self):
        slides = stub_slides(6)
        slides[2]["text"]["headline"] = " ".join(["كلمة"] * 10)
        self.assertIn("R114", codes(self.lint({"title": "t", "slides": slides})))
        slides[2]["text"]["headline"] = " ".join(["كلمة"] * 9)
        self.assertNotIn("R114", codes(self.lint({"title": "t", "slides": slides})))

    def test_r115_r116_body(self):
        slides = stub_slides(6)
        slides[2]["text"]["body"] = ["نقطة"] * 6
        self.assertIn("R115", codes(self.lint({"title": "t", "slides": slides})))
        slides[2]["text"]["body"] = [" ".join(["كلمة"] * 19)]
        self.assertIn("R116", codes(self.lint({"title": "t", "slides": slides}), "warnings"))

    def test_r117_anatomy_fields(self):
        slides = stub_slides(6)
        slides[2]["visual"] = {"type": "anatomy"}
        self.assertIn("R117", codes(self.lint({"title": "t", "slides": slides})))

    def test_r118_image_without_source(self):
        slides = stub_slides(6)
        slides[2]["visual"] = {"type": "image", "ref": "x"}
        self.assertIn("R118", codes(self.lint({"title": "t", "image_source": "none", "slides": slides})))

    def test_r119_transition_overuse(self):
        slides = stub_slides(8)
        for s in slides[1:6]:
            s["transition"] = "iris"
        self.assertIn("R119", codes(self.lint({"title": "t", "slides": slides}), "warnings"))

    def test_r120_emoji(self):
        slides = stub_slides(6)
        slides[2]["text"]["headline"] = "عنوان \U0001F680"
        self.assertIn("R120", codes(self.lint({"title": "t", "slides": slides})))

    def test_r121_mixed_digits(self):
        slides = stub_slides(6)
        slides[2]["text"]["body"] = ["١٢ ساعة"]
        slides[3]["text"]["body"] = ["12 hours"]
        self.assertIn("R121", codes(self.lint({"title": "t", "slides": slides}), "warnings"))

    def test_r122_low_contrast_theme(self):
        plan = {"title": "t", "slides": stub_slides(6),
                "theme": {"preset": "paper", "ink": "#BBBBBB", "accent": "#EEEEEE"}}
        self.assertIn("R122", codes(self.lint(plan), "warnings"))

    def test_r123_r124_visual_hints(self):
        slides = stub_slides(6)
        slides[2]["visual"] = {"type": "image"}
        slides[3]["visual"] = {"type": "chart"}
        report = self.lint({"title": "t", "image_source": "web", "slides": slides})
        self.assertIn("R123", codes(report, "warnings"))
        self.assertIn("R124", codes(report, "warnings"))


if __name__ == "__main__":
    unittest.main()
