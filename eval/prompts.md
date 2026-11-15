# Evaluation prompts (roadmap NM-27)

Twelve requests, each run once with skill version A and once with version B, by the same agent and model, in fresh
sessions. Save each result as `runs/<label>/<id>/` (the project folder: `deck.plan.json`, `deck.html`, `assets/`),
and, when the agent reports it, `runs/<label>/<id>/usage.json` (`{"input_tokens": N, "output_tokens": N}`).
Give the agent the request text only; answer its questions with the default (recommended) option.

| id | lang | kind | request |
|---|---|---|---|
| ar-paper | ar | scientific | اشرح ورقة "Attention Is All You Need" في عرض من عشر شرائح لطلاب الجامعة |
| ar-lab | ar | scientific | حوّل نتائج تجربة السقوط الحر (ثمانية أجسام، ثلاثة ارتفاعات) إلى عرض علمي مع جدول ومعادلات |
| ar-ops | ar | technical | عرض لمديري الموانئ: كيف نرفع إنتاجية الرافعات، بأرقام سنة تشغيل |
| ar-health | ar | general | عرض توعوي عن النوم وأثره على الذاكرة لطلاب الثانوية |
| ar-policy | ar | general | عرض لمجلس إدارة: خياران لتوسعة المستودعات مع التوصية |
| ar-short | ar | summary | ملخص سريع من خمس شرائح لتقرير ربع سنوي للمبيعات |
| ar-bidi | ar | technical | عرض عربي عن إصدارات GPT-4 وClaude 3 وLlama 3 وأداؤها على MMLU |
| en-paper | en | scientific | Explain the paper "Distilling the Knowledge in a Neural Network" in ten slides for engineers |
| en-ops | en | technical | A deck for a platform team: how we cut p95 latency from 420 ms to 180 ms |
| en-general | en | general | A talk for a city council on how a container port moves a box from ship to road |
| en-finance | en | general | Quarterly results for investors: revenue, margin, three risks |
| en-short | en | summary | Five slides summarising a 40-page climate report for busy executives |

What each prompt exercises: Arabic and English decks, right to left and left to right, scientific content (tables,
equations, charts with error bars), mixed Arabic and Latin text, decision decks, very short decks.
