# Fair Pay Playground
SDG 5 (Gender Equality) - *Gender Income Gap Analysis Using Permutation Tests and Odds Ratios*,
explained so that a 5-year-old can follow it. ML model + npm web app.

## Run it
```
npm start                 # open http://localhost:3000   (needs Node 18+, no npm install)
npm test                  # runs: node --test
```
The zip ships with PRACTICE numbers (pretend data, shown with a yellow banner).
**For real results** (needs Python and internet or the file `data/adult.data`):
```
pip install -r ml/requirements.txt
npm run train             # = python ml/train.py   (use `python3` if needed)
npm start
```
This overwrites `public/data/results.json`; the banner disappears and every number on the page
(and in the "Grown-up corner" match table) comes from your real data.

## The story (one idea per scene)
1. Big pay = a gold star. Question: do men and women get stars equally?
2. Count stars: 100 men vs 100 women (the raw gap).
3. Shake the name-tag jar: permutation test. Blue dots = gaps made by luck, red flag = real gap.
4. Compare alike people: gap in "stars per 100" after matching age and hours, school, job (adjusted models).
5. Twin game: the ML "Magic Helper" (logistic regression) gives two identical twins, boy and girl, a star chance. Move the sliders.
6. Does school change the gap? (gender x education interaction)
7. What we learned + Grown-up corner: a table matching each kid sentence to its real statistic.
A "Read to me" button uses the browser's built-in voice, for kids who cannot read yet.

The story also includes dependency-free statistical graphs: observed rates with a bootstrap
95% confidence interval, a permutation null dot plot, adjusted-gap trend, and education-group gaps.

## Files
- `server.js` static server (Node built-ins only); `public/` the web app
- `public/model.js` runs the exported ML model in the browser (same code is unit-tested in Node)
- `ml/train.py` loads data, runs permutation tests and logistic regressions, trains the Magic Helper, writes `results.json`
- `test/` checks: JS predictions equal Python's to 1e-9, JSON completeness, server routes and path-traversal blocking

## How the numbers map
- "Stars per 100" = predicted probability of income > 50K x 100.
- Staircase gap = average of P(male) - P(female) over everyone, each model holding other variables equal.
- Education bars use the Magic Helper's average male-minus-female gap within each education group.
- Odds ratios, CIs, p-values, AUC and the interaction test are in the Grown-up corner.

## Limits (be honest in your report)
1994 US census data; income is only above/below 50K; results show a pattern, not its cause or proof of
discrimination; the model copies old patterns and cannot say what is fair; survey weights not used.
