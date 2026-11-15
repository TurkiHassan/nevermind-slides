"""Template tells in audit-deck (roadmap NM-20, codes T101-T104): warnings only."""
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from _helpers import load_deck_helper

dh = load_deck_helper()


def tells(slides: list[str]) -> list[str]:
    html = "<main>" + "".join(slides) + "</main>"
    dom = dh._DeckDom()
    dom.feed(html)
    dom.close()
    return [t[:4] for t in dh._template_tells(dom, [])]


def slide(inner: str, role: str = "concept") -> str:
    return f'<section class="slide" data-role="{role}"><div class="camera-rig">{inner}</div></section>'


KICKED = slide('<p class="nm-kicker">سطر</p><h2>عنوان</h2><p>نص</p>')
PLAIN = slide("<h2>عنوان</h2><figure><svg></svg></figure>")
CARDS = slide('<h2>عنوان</h2><div><article class="nm-card">أ</article><article class="nm-card">ب</article><article class="nm-card">ج</article></div>')


class TemplateTellsTest(unittest.TestCase):
    def test_a_kicker_above_most_titles(self):
        self.assertIn("T101", tells([KICKED] * 4 + [PLAIN]))
        self.assertNotIn("T101", tells([KICKED] * 2 + [PLAIN] * 3))
        self.assertNotIn("T101", tells([slide('<p class="nm-kicker">ف</p><h1>غ</h1>', "cover")] + [PLAIN] * 4))

    def test_rows_of_identical_cards(self):
        self.assertIn("T102", tells([CARDS] * 3 + [PLAIN]))
        self.assertNotIn("T102", tells([CARDS] * 2 + [PLAIN] * 2))

    def test_numbering_outside_a_sequence(self):
        numbered = slide("<h2>عنوان</h2><p>01 الأول</p><p>02 الثاني</p>")
        self.assertIn("T103", tells([numbered, PLAIN]))
        self.assertNotIn("T103", tells([numbered.replace('data-role="concept"', 'data-role="process"'), PLAIN]))

    def test_one_coloured_word_in_titles(self):
        accent = slide('<h2>الحل في <span class="text-accent">الجدولة</span> لا الشراء</h2>')
        self.assertIn("T104", tells([accent, accent, PLAIN]))
        self.assertNotIn("T104", tells([accent, PLAIN, PLAIN]))

    def test_a_clean_deck_raises_none(self):
        self.assertEqual(tells([KICKED, PLAIN, PLAIN, CARDS, PLAIN]), [])

    def test_new_stub_plans_do_not_put_a_kicker_above_every_title(self):
        plan = dh.make_stub_plan("عرض", 10)
        content = [s for s in plan["slides"] if s["role"] not in ("cover", "closing", "quote", "section")]
        with_kicker = [s for s in content if "kicker" in s["text"]]
        self.assertLessEqual(len(with_kicker) / len(content), 0.5)
        with tempfile.TemporaryDirectory() as tmp:
            html, _, _ = dh.render_deck(plan, Path(tmp), font_files=[])
            dom = dh._DeckDom()
            dom.feed(html)
            self.assertNotIn("T101", [t[:4] for t in dh._template_tells(dom, [])])


if __name__ == "__main__":
    unittest.main()
