# محرّر Nevermind Studio داخل مستودع المهارة

هذه **نسخة مصاحبة** من شفرة محرّر `nm-studio`، موضوعها هنا ليحمل مستودع المهارة مصدر المحرّر معه. المحرّر نفسه لا يشترط هذه النسخة للعمل: النسخة الجاهزة المضمّنة في `../resources/nm-studio/nm-studio.mjs` هي ما يستدعيه `../scripts/deck_helper.py` افتراضيًا.

- **المصدر الأساسي للتطوير:** مشروع `~/Desktop/Slide-Editor` (فيه أيضًا الاختبارات الكاملة ووثائق المراحل والفيديو). هذه النسخة لا تُحرَّر يدويًا إلا عند تعذّر الوصول إلى الأساس، ويُزامَن بعدها.
- **الاختبارات:** `npm install` ثم `npm test` (vitest) و`npm run e2e` (Playwright، Chromium). بعض اختبارات المتصفح تحتاج `fixtures/real/`، وهي مستبعدة من git لثقلها (21MB)؛ وُجدت في مشروع الأساس فقط.
- **البناء:** `npm run build` ينتج `dist/nm-studio.mjs`. انسخه إلى `../resources/nm-studio/nm-studio.mjs` ليصبح هو ما تشغّله المهارة.

## المزامنة من مشروع الأساس

```bash
python3 ../scripts/sync-editor.sh ~/Desktop/Slide-Editor
```

ينسخ `src` و`test` و`fixtures/synthetic` و`scripts` وملفات الإعداد، ويعيد بناء النسخة المضمّنة. ملفات `docs/` و`spikes/` و`launch-video/` و`fixtures/real/` لا تُنسخ.

الشفرة جزء من هذا المستودع وتخضع لرخصته (`MIT`).
