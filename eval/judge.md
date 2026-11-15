# Blind judgement (roadmap NM-27)

`score.mjs --packets DIR` writes, per prompt, two contact sheets named `X.png` and `Y.png` in a random but fixed
order; the key that maps X and Y to versions A and B is kept in `key.json`, which the judge must not open.

Give the judge (a person, or a model in a fresh session with only the packet) the request text and the two contact
sheets, and these instructions:

> Two slide decks answer the same request. You do not know which tool made which. For each, answer:
> 1. **correct**: does the deck state anything false or invent a finding? (true when nothing false)
> 2. **clear**: would the audience in the request understand the main idea from the slides alone? (1 to 5)
> 3. **designed**: does each slide show its information in a fitting way (table, chart, figure, equation, plain
>    type), with one accent, readable text, and nothing cramped or empty? (1 to 5)
> 4. **verdict**: X, Y or tie, for the deck you would present.
> Write the answers as JSON: `{"X": {"correct": true, "clear": 4, "designed": 3}, "Y": {...}, "verdict": "X", "why": "one sentence"}`.

Save each answer as `verdicts/<id>.json` next to the packets. `score.mjs --verdicts DIR` then reads them with the key.

Acceptance (roadmap section 6): version B wins or ties on 70% of the prompts or more, and is never judged incorrect
on a prompt where A was correct.
