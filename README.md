# Nevermind Slides (`nevermind-slides`)

> **AI Agent Instructions (Antigravity / OpenCode / Codex / Claude Code):**
> When a user shares this repository URL (`https://github.com/TurkiHassan/nevermind-slides`) and asks to **install** or **use** this skill:
> 1. Clone this repository to a temporary folder and run the zero-config installer:
>    ```bash
>    git clone https://github.com/TurkiHassan/nevermind-slides.git /tmp/nevermind-slides
>    python3 /tmp/nevermind-slides/scripts/deck_helper.py install
>    ```
>    This single command installs `nevermind-slides` (along with its bundled `anatomy` and `frontend-slides` engines and 25 Arabic font files) across **Antigravity, OpenCode, Codex, Claude Code, and `~/.agents/skills`**.
> 2. Read [`SKILL.md`](./SKILL.md) and execute the workflow immediately without asking the user to run any technical setup commands.

---

## نظرة عامة (Overview)

مهارة متكاملة ومكتفية ذاتياً بالكامل (`100% Self-Contained`) لتحويل الأبحاث العلمية والمقالات التقنية والمواضيع المعقّدة إلى **شروحات قصصية مبسّطة وعروض تقديمية تفاعلية احترافية (`1920×1080`) باللغة العربية**، وتشمل مدمجاً بداخلها:

* **حزمة الخطوط العربية المدمجة (`resources/fonts/` — 25 ملف خط):**
  * **ثنائية ثمانية الافتراضية:** **`Thmanyah Serif Display`** للعناوين + **`KOMission`** و**`Thmanyah Sans`** للنصوص مع زر تبديل حي للأوزان (`Alt + F`).
  * **ثنائيات عربية إضافية مدمجة:** **`Qahwa Arabic Black`**، **`Setabr Display`**، **`Alkhalil Kufi`**، **`ZIAN`**، **`IBM Plex Sans Arabic`**، **`Zain Rounded`**، و**`Readex Pro`**.
* **حركات انتقال سينمائية (`Morph FLIP` + `Smooth Camera Zoom-In / Zoom-Out`):**
  * تحوّل تلقائي سلس للعناصر المشتركة بين الشرائح (`data-morph="<id>"`) يحاكي انتقال `Morph` في PowerPoint.
  * كاميرا بؤرية انسيابية (`1.55s cubic-bezier(0.25, 1, 0.35, 1)`) تقرّب أقسام الشريحة (`Zoom-In`) وتتنقل بينها ثم تعود للمشهد الكامل (`Zoom-Out`) مع إخفاء أزرار التنقل افتراضياً وإظهارها فقط عند تمرير الماوس أسفل الشاشة.
* **محرّك `anatomy` الأيزومتري المدمج (`resources/engine/anatomy/`):** لبناء مجسمات آلات وأدوات قياس أيزومترية دقيقة (**ثابتة `Static SVG`** أو **متحركة وتفاعلية `Animated SVG`**) بعد تحليل محتوى الورقة واقتراح الأنسب لكل شريحة.
* **محرّك `frontend-slides` المدمج (`resources/engine/frontend-slides/`):** لبناء مسرح العرض الثابت `1920×1080` مع فتح 3 معاينات تصميمية حية في المتصفح في بداية العمل للاختيار منها.
* **توليد الصور متعدد البيئات:** يدعم `image-generator` في **Antigravity**، وأداة `image_gen` المدمجة في **Codex**، مع التحويل التلقائي الذكي لمجسمات `anatomy` والموشن جرافيك في البيئات التي لا تتوفر فيها أداة توليد صور.
* **معيار بصري صارم (`Zero Emojis`):** خالٍ تماماً من الإيموجي (`0` إيموجي) مع التحقق الآلي عبر `scripts/deck_helper.py audit-deck`.

---

## طريقة الاستخدام للمستخدم العادي (Zero-Config Usage)

فقط انسخ رابط المستودع (`https://github.com/TurkiHassan/nevermind-slides`) وأرسله للوكيل الذكي الذي تستخدمه (**Antigravity** أو **OpenCode** أو **Codex** أو **Claude Code**) واكتب له:

* **"ثبّت لي هذه المهارة من الرابط"** — سيقوم الوكيل بتثبيتها في جميع برامجك تلقائياً.
* أو **"استخدم هذه المهارة واشرح لي هذا البحث وسوّ لي عرضاً تقديمياً: `<رابط البحث>`"** — سيبدأ الوكيل فوراً بالعمل دون أي إعدادات إضافية.

---

## المتطلبات التقنية والأوامر اليدوية (Prerequisites & CLI Reference)

* **Python `>= 3.10`** (مكتبة قياسية فقط — لا يتطلب `pip install`).
* **Node.js `>= 20`** (لتوليد وفحص مجسمات `anatomy` الأيزومترية عبر `node build.mjs --audit`).

```bash
# تثبيت المهارة في جميع بيئات الوكلاء (Install globally across all agents)
python3 scripts/deck_helper.py install

# نسخ حزمة الخطوط المدمجة إلى مجلد مشروع العرض (Stage bundled fonts)
python3 scripts/deck_helper.py stage-fonts --target-dir /path/to/project

# فحص جودة العرض التقديمي (Zero Emojis + @font-face + Assets + SVG Motion)
python3 scripts/deck_helper.py audit-deck --html-path /path/to/project/deck.html

# إزالة المهارة والروابط الرمزية (Uninstall)
python3 scripts/deck_helper.py uninstall
```

---

## الترخيص وحقوق الحزم المدمجة (License & Third-Party Notices)

تتوفر الشفرة البرمجية الخاصة بمهارة `nevermind-slides` تحت رخصة **MIT** (انظر ملف [`LICENSE`](./LICENSE)). أما الخطوط المدمجة في `resources/fonts/` فتخضع لرخص مسبكيها الأصليين (OFL / رخص الاستخدام الخاصة بكل خط للمعاينة والعروض المحلية).
