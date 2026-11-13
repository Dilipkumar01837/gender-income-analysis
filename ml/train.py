"""Train the 'Magic Helper' (logistic regression) and export everything the web page needs.

  python ml/train.py                       # real data (data/adult.data or OpenML download)
  python ml/train.py --data path/adult.data
  python ml/train.py --synthetic           # FAKE practice data, flagged as demo in the page
"""
import argparse, json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

from adult_data import load_data
from logit import Logit, design, lr_test
from permutation import permutation_test, bootstrap_gap_ci

HELPER = dict(num=["female", "age_c", "age_c2", "hours_c", "edu_c"], cat=["occ"],
              inter=[("female", "edu_c")])
STAIRS = [
    ("m0", dict(num=["female"], cat=[])),
    ("m1", dict(num=["female", "age_c", "age_c2", "hours_c"], cat=[])),
    ("m2", dict(num=["female", "age_c", "age_c2", "hours_c", "edu_c"], cat=[])),
    ("m3", dict(num=["female", "age_c", "age_c2", "hours_c", "edu_c"], cat=["occ"])),
]


def marginal_probs(model, df, num, cat, inter=()):
    """Everyone's predicted P(>50K) if they were male vs if they were female (all else equal)."""
    p0 = model.predict(design(df.assign(female=0), num, cat, inter))
    p1 = model.predict(design(df.assign(female=1), num, cat, inter))
    return p0, p1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/adult.data")
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--n-perm", type=int, default=5000)
    ap.add_argument("--out", default="public/data/results.json")
    a = ap.parse_args()

    df = load_data(a.data, synthetic=a.synthetic)
    y = df.income.values
    R = {"demo": bool(a.synthetic), "n": int(len(df)),
         "n_female": int(df.female.sum()), "n_male": int((1 - df.female).sum())}

    # 1) Counting stars + "shaking the name tags" (permutation test)
    perm = permutation_test(df.income, df.female, a.n_perm)
    rng = np.random.default_rng(1)
    samples = rng.choice(perm["null"], size=120, replace=False)
    R["raw"] = {"rate_male": float(df.income[df.female == 0].mean()),
                "rate_female": float(df.income[df.female == 1].mean()),
                "gap": perm["observed_gap"], "perm_p": perm["p_value"], "n_perm": a.n_perm,
                "gap_boot_ci95": list(bootstrap_gap_ci(df.income, df.female))}
    R["shake"] = {"samples": [round(float(v), 5) for v in samples],
                  "observed": perm["observed_gap"], "null_sd": perm["null_sd"]}
    ps = permutation_test(df.income, df.female, a.n_perm, seed=7, strata=df.edu_group + "|" + df.occ)
    R["stratified"] = {"p": ps["p_value"], "expected_gap_from_mix": ps["null_mean"]}

    # 2) Staircase: gap in "stars per 100 people" as we compare more and more alike people
    stairs = []
    for key, sp in STAIRS:
        m = Logit(design(df, sp["num"], sp["cat"]), df.income)
        p0, p1 = marginal_probs(m, df, sp["num"], sp["cat"])
        stairs.append({"key": key, "gap": float((p0 - p1).mean()), **m.odds_ratio("female")})
    R["stairs"] = stairs

    # 3) The Magic Helper (ML model with gender x education interaction)
    X = design(df, HELPER["num"], HELPER["cat"], HELPER["inter"])
    helper = Logit(X, df.income)
    main_m = Logit(design(df, HELPER["num"], HELPER["cat"]), df.income)
    R["interaction"] = {"OR_per_edu_year": helper.odds_ratio("female:edu_c"),
                        "LR_test": lr_test(main_m, helper)}
    p0, p1 = marginal_probs(helper, df, HELPER["num"], HELPER["cat"], HELPER["inter"])
    R["by_education"] = []
    for g in ["<=HS", "SomeCollege", "Bachelors", "Postgrad"]:
        mask = (df.edu_group == g).values
        R["by_education"].append({"edu_group": g, "n": int(mask.sum()),
                                  "gap": float((p0[mask] - p1[mask]).mean())})

    # hold-out check of the helper (80% learn, 20% test)
    idx = np.random.default_rng(42).permutation(len(df))
    cut = int(0.8 * len(df)); tr, te = idx[:cut], idx[cut:]
    h_tr = Logit(X.iloc[tr], y[tr]); pt = h_tr.predict(X.iloc[te])
    base = max(y[te].mean(), 1 - y[te].mean())
    levels = sorted(df.occ.unique())
    means = {"age_mean": float(df.age.mean()), "hours_mean": float(df.hours.mean()),
             "edu_mean": float(df.edu_num.mean())}
    R["model"] = {"intercept": float(helper.beta["const"]),
                  "coefs": {k: float(v) for k, v in helper.beta.items() if k != "const"},
                  "center": means, "occupations": levels, "occ_reference": levels[0],
                  "auc_holdout": float(roc_auc_score(y[te], pt)),
                  "accuracy_holdout": float(((pt > 0.5) == y[te]).mean()),
                  "accuracy_always_no": float(base)}
    R["ranges"] = {"age": [int(df.age.min()), int(df.age.max())],
                   "hours": [int(df.hours.min()), int(df.hours.max())],
                   "edu": [int(df.edu_num.min()), int(df.edu_num.max())]}

    # odds ratios by education group (grown-up corner)
    base_num = ["female", "age_c", "age_c2", "hours_c"]
    g_int = Logit(design(df, base_num, ["occ", "edu_group"], [("female", "edu_group")]), df.income)
    grp = [{"edu_group": "<=HS", **g_int.odds_ratio("female")}]
    for lvl in ["SomeCollege", "Bachelors", "Postgrad"]:
        grp.append({"edu_group": lvl, **g_int.odds_ratio_sum(["female", f"female:edu_group_{lvl}"])})
    R["or_by_education"] = grp

    # test cases so the JavaScript can prove it computes the same answers as Python
    def predict_row(inp):
        x = pd.Series(0.0, index=X.columns)
        ac = (inp["age"] - means["age_mean"]) / 10; hc = (inp["hours"] - means["hours_mean"]) / 10
        ec = inp["edu"] - means["edu_mean"]
        x["female"] = inp["female"]; x["age_c"] = ac; x["age_c2"] = ac ** 2
        x["hours_c"] = hc; x["edu_c"] = ec; x["female:edu_c"] = inp["female"] * ec
        if "occ_" + inp["occ"] in x.index:
            x["occ_" + inp["occ"]] = 1.0
        return float(helper.predict(pd.DataFrame([x]))[0])
    cases = []
    for i, (f, age, hrs, edu) in enumerate([(0, 30, 40, 9), (1, 30, 40, 9), (0, 45, 50, 13),
                                            (1, 45, 50, 13), (1, 22, 20, 10), (0, 60, 35, 16)]):
        inp = {"female": f, "age": age, "hours": hrs, "edu": edu, "occ": levels[(i + 1) % len(levels)]}
        cases.append({"input": inp, "probability": predict_row(inp)})
    R["checks"] = cases

    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(R, indent=1, default=float))
    r = R["raw"]
    print(f"Wrote {out}  (demo={R['demo']})")
    print(f"men {r['rate_male']:.3f} women {r['rate_female']:.3f} gap {r['gap']:.3f} p={r['perm_p']:.4f}")
    print("gap by step (stars/100):", [round(s['gap'] * 100, 1) for s in stairs])
    print(f"helper hold-out AUC {R['model']['auc_holdout']:.3f}, accuracy {R['model']['accuracy_holdout']:.3f}")


if __name__ == "__main__":
    main()
