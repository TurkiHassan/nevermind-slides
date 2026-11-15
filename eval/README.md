# Evaluating a new version of the skill (roadmap NM-27)

1. Run the twelve requests in `prompts.md` with version A and with version B (same agent, same model, fresh
   sessions), saving each project as `eval/runs/A/<id>/` and `eval/runs/B/<id>/`.
2. `node eval/score.mjs eval/runs/A eval/runs/B --out eval/out --packets` runs the gates on every deck and writes
   `comparison.md` (a quick read from gates and quality) and blind packets for the judges.
3. Judges answer per `judge.md`; save their JSON in `eval/out/verdicts/`.
4. `node eval/score.mjs eval/runs/A eval/runs/B --out eval/out --no-check --verdicts eval/out/verdicts` reports the
   result. Accept B when it wins or ties on 70% of prompts and is never judged incorrect where A was correct.

`runs/` and `out/` are not committed (they hold generated decks and screenshots).
