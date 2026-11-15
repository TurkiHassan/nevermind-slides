# Nevermind Slides (`nevermind-slides`)

> **AI Agent Instructions (Antigravity / OpenCode / Codex / Claude Code):**
> When a user shares this repository URL (`https://github.com/TurkiHassan/nevermind-slides`) and asks to **install** or **use** this skill:
> 1. Clone this repository to a temporary folder and run the zero-config installer:
>    ```bash
>    git clone https://github.com/TurkiHassan/nevermind-slides.git /tmp/nevermind-slides
>    python3 /tmp/nevermind-slides/scripts/deck_helper.py install
>    ```
>    This single command installs `nevermind-slides` (along with its bundled `anatomy` and `frontend-slides` engines and the redistributable Arabic fonts) across **Antigravity, OpenCode, Codex, Claude Code, and `~/.agents/skills`**.
> 2. Read [`SKILL.md`](./SKILL.md) and execute the workflow immediately without asking the user to run any technical setup commands.

---

## نظرة عامة (Overview)

مهارة متكاملة ومكتفية ذاتياً (`100% Self-Contained`) لتحويل الأبحاث والمقالات التقنية والمواضيع المعقّدة إلى **شروحات قصصية مبسّطة وعروض تقديمية سينمائية (`1920×1080`) باللغة العربية**.

### الجديد في الإصدار الثاني (v2)

| المكوّن | ما يقدّمه |
| :--- | :--- |
| **محرّك الحركة المدمج** (`resources/engine/nm-runtime/`) | كل الحركة تُكتب بسمات `data-*` دون أي JavaScript: Morph بطبقة أشباح لا يمطّ الحواف ولا النص (صندوق، كلمات، صورة، مسار، رقم) بمسارات قوسية ونوابض، 10 انتقالات تُختار حسب علاقة الشريحة بما قبلها، خطوات موحّدة، كاميرا، ونظرة عامة على الشرائح |
| **عزل جزء من الشريحة** | `focus` بقعة ضوء متنقلة، `detail` رفع العنصر وفتح لوحة تفاصيل (4 أشكال)، `lens` عدسة مكبّرة، `pins` دبابيس شرح مرقّمة، `slice` شقّ الشريحة وإدراج شريط تفاصيل |
| **الدياغرام والتخطيط** | 18 نوعاً (13 مخططاً + 5 رسوم بيانية) بلغة نصية بسيطة وتخطيط آلي من اليمين لليسار، موصلات بين أي عناصر، وتراكيب `nm-l-*` جاهزة للشرائح |
| **anatomy: الموضوع أولاً** | سلّم من 5 درجات يفرض رسم شيء من عالم الموضوع نفسه بدل الأجهزة الثابتة، و71 عنصراً جاهزاً (مبانٍ، مركبات، أشخاص، تقنية، أوراق، تضاريس)، وفاحص `brief-check` يرفض الأجهزة العامة |
| **صور الويب البديلة** | عند غياب أداة توليد الصور: بحث في مصادر برخص مفتوحة، تنزيل، تشذيب حول بؤرة الصورة، توحيد لوني، وتوثيق المصادر آلياً |
| **الخطة والفحص** | `plan-lint` بقواعد مخرج حركة، `scaffold` يبني الهيكل كاملاً من الخطة، `audit-deck` و`check` يفحصان العرض في Chrome (تجاوز الحدود، قصّ النص، التباين، الخطوط) |
| **عرض نموذجي** (`examples/showcase/`) | 14 شريحة عن رحلة الحاوية في ميناء حديث تستخدم كل الخصائص وتجتاز كل الفحوص |

### المكونات الثابتة

* **الخطوط العربية (`resources/fonts/`):** IBM Plex Sans Arabic وReadex Pro (الزوج المفتوح الافتراضي عند غياب ثمانية)، مع قهوة، سطبر، الخليل الكوفي، KOMission، Zain Rounded. خطوط **ثمانية** و**زيان** لم تعد مضمّنة لأن رخصتيهما تمنعان إعادة التوزيع؛ ثبّتها من مصدرها الرسمي (أو ضعها في مجلد يشير إليه `NM_FONTS_DIR`) وسيلتقطها `stage-fonts` تلقائيًا.
* **محرّر Nevermind Studio المدمج** للتعديل اليدوي وتثبيت الملاحظات للوكيل.
* **معيار صارم:** صفر إيموجي، اتجاه RTL، عدم تفكيك الحروف العربية، نظام أرقام واحد في العرض.

---

## طريقة الاستخدام للمستخدم العادي (Zero-Config Usage)

فقط انسخ رابط المستودع (`https://github.com/TurkiHassan/nevermind-slides`) وأرسله للوكيل الذكي الذي تستخدمه (**Antigravity** أو **OpenCode** أو **Codex** أو **Claude Code**) واكتب له:

* **"ثبّت لي هذه المهارة من الرابط"** — سيقوم الوكيل بتثبيتها في جميع برامجك تلقائياً.
* أو **"استخدم هذه المهارة واشرح لي هذا البحث وسوّ لي عرضاً تقديمياً: `<رابط البحث>`"** — سيبدأ الوكيل فوراً بالعمل دون أي إعدادات إضافية.

---

## المتطلبات التقنية والأوامر اليدوية (Prerequisites & CLI Reference)

* **Python `>= 3.10`** (مكتبة قياسية فقط — لا يتطلب `pip install`).
* **Node.js `>= 20`** (لتوليد وفحص مجسمات `anatomy` الأيزومترية عبر `node build.mjs --audit`).
* **محرّر Nevermind Studio (`edit` و`notes`):** يأتي **مضمَّنًا** كملف بناء واحد في `resources/nm-studio/nm-studio.mjs` ويُشغَّل بـ`node`، فلا يحتاج تثبيتًا منفصلًا. يتقدّم عليه المتغير `NM_STUDIO` (ملف تنفيذي أو مسار `dist/nm-studio.mjs`) ثم `nm-studio` في `PATH` إن وُجد؛ ولا يخرج بالرمز `2` إلا إذا غاب `Node.js >= 20` أو كان `NM_STUDIO` معطوبًا. شفرته المصاحبة في `editor/`.

```bash
# تثبيت المهارة في جميع بيئات الوكلاء (Install globally across all agents)
python3 scripts/deck_helper.py install

# نسخ حزمة الخطوط المدمجة إلى مجلد مشروع العرض (Stage bundled fonts)
python3 scripts/deck_helper.py stage-fonts --target-dir /path/to/project

# خطة العرض: إنشاء، فحص، وبناء الهيكل
python3 scripts/deck_helper.py plan-init --target-dir /path/to/project --title "العنوان" --slides 10
python3 scripts/deck_helper.py plan-lint --plan /path/to/project/deck.plan.json
python3 scripts/deck_helper.py scaffold --plan /path/to/project/deck.plan.json

# فحص العرض في Chrome مع لقطات لكل شريحة
python3 scripts/deck_helper.py check --html-path /path/to/project/deck.html --shots /path/to/project/.nm-shots

# صور الويب عند غياب أداة توليد الصور
python3 scripts/image_fetch.py auto --query "container port crane" --slot 1100x900 --name port --project /path/to/project

# فحص جودة العرض التقديمي (Zero Emojis + @font-face + Assets + Runtime contract)
python3 scripts/deck_helper.py audit-deck --html-path /path/to/project/deck.html

# فتح العرض في محرّر Nevermind Studio للتعديل اليدوي (المحرّر مضمّن)
python3 scripts/deck_helper.py edit --html-path /path/to/project/deck.html

# ملاحظات المستخدم المثبّتة من المحرّر: عرضها وإغلاق المنفَّذة
python3 scripts/deck_helper.py notes list --html-path /path/to/project/deck.html
python3 scripts/deck_helper.py notes done --html-path /path/to/project/deck.html <note-id>

# إزالة المهارة والروابط الرمزية (Uninstall)
python3 scripts/deck_helper.py uninstall
```

---

## الترخيص وحقوق الحزم المدمجة (License & Third-Party Notices)

تتوفر الشفرة البرمجية الخاصة بمهارة `nevermind-slides` تحت رخصة **MIT** (انظر ملف [`LICENSE`](./LICENSE)). أما الخطوط المدمجة في `resources/fonts/` فتخضع لرخص مسبكيها الأصليين؛ حالة كل خط موثّقة في [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
