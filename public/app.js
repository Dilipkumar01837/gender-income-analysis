(function () {
  const FP = window.FairPay;
  const $ = (s) => document.querySelector(s);
  let R = null, idx = 0, scenes = [];

  const EDU = { "<=HS": "School only (up to high school)", SomeCollege: "A bit of college",
                Bachelors: "College degree", Postgrad: "Extra-big college degree" };
  const STEP = { m0: "Everyone together", m1: "Same age and same work hours",
                 m2: "...and same school years", m3: "...and same kind of job" };
  const stripTags = (h) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const pp = (x) => (x * 100).toFixed(1);

  function grid(rate) {
    const n = Math.round(rate * 100);
    let h = "";
    for (let i = 0; i < 100; i++) h += `<span class="cell${i < n ? " star" : ""}">${i < n ? "⭐" : ""}</span>`;
    return `<div class="grid">${h}</div>`;
  }
  function bars(rows) {
    const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.001);
    return `<div class="bars">` + rows.map((r) =>
      `<div class="row"><div class="lab">${r.label}</div><div class="track"><div class="fill" style="width:${Math.max(8, Math.abs(r.value) / max * 100)}%">${r.value.toFixed(1)} ⭐</div></div></div>`).join("") + `</div>`;
  }
  function rateChart(raw) {
    const values = [raw.rate_male * 100, raw.rate_female * 100];
    const max = Math.max(...values, raw.gap_boot_ci95[1] * 100) * 1.18;
    const y = (v) => 150 - (v / max) * 112;
    const bar = (x, v, color, label) => `<rect x="${x}" y="${y(v)}" width="72" height="${150 - y(v)}" rx="8" fill="${color}"/>
      <text x="${x + 36}" y="${y(v) - 8}" text-anchor="middle" class="chart-value">${v.toFixed(1)}%</text>
      <text x="${x + 36}" y="174" text-anchor="middle">${label}</text>`;
    const ciLo = raw.gap_boot_ci95[0] * 100, ciHi = raw.gap_boot_ci95[1] * 100;
    return `<div class="stat-chart"><div class="chart-title">Observed high-income rate</div>
      <svg viewBox="0 0 360 205" role="img" aria-label="Bar chart showing high-income rates for men and women">
        <line x1="42" y1="150" x2="330" y2="150" class="chart-axis"/>
        <line x1="42" y1="${y(ciHi)}" x2="330" y2="${y(ciHi)}" class="chart-guide"/>
        ${bar(82, values[0], "var(--men)", "Men")}
        ${bar(208, values[1], "var(--women)", "Women")}
        <text x="42" y="${y(ciHi) - 6}" class="chart-note">gap 95% CI: ${ciLo.toFixed(1)}–${ciHi.toFixed(1)} pts</text>
      </svg></div>`;
  }
  function permutationChart(raw, samples) {
    const vals = samples.map((v) => v * 100), observed = raw.gap * 100;
    const min = Math.min(0, ...vals), max = Math.max(observed, ...vals), span = Math.max(max - min, 1);
    const x = (v) => 38 + ((v - min) / span) * 284;
    const dots = vals.map((v, i) => `<circle cx="${x(v).toFixed(1)}" cy="${38 + (i % 7) * 13}" r="3.5"/>`).join("");
    return `<div class="stat-chart"><div class="chart-title">Permutation test: gaps made by luck</div>
      <svg viewBox="0 0 360 145" role="img" aria-label="Dot plot of permutation gaps with the real gap marked">
        <line x1="38" y1="126" x2="322" y2="126" class="chart-axis"/>
        <line x1="${x(0)}" y1="20" x2="${x(0)}" y2="126" class="chart-guide"/>
        <g class="null-dots">${dots}</g>
        <line x1="${x(observed)}" y1="12" x2="${x(observed)}" y2="126" class="chart-observed"/>
        <text x="${x(observed)}" y="10" text-anchor="middle" class="chart-note">real gap ${observed.toFixed(1)} pts</text>
        <text x="38" y="141" text-anchor="middle">−${Math.abs(min).toFixed(0)}</text>
        <text x="${x(0)}" y="141" text-anchor="middle">0</text>
        <text x="322" y="141" text-anchor="middle">${max.toFixed(0)}</text>
      </svg><div class="chart-caption">Blue dots are ${samples.length} sampled shuffles; the red line is the real gap.</div></div>`;
  }
  function staircaseChart(stairs) {
    const values = stairs.map((s) => s.gap * 100), max = Math.max(...values) * 1.15;
    const x = (i) => 42 + i * (274 / (values.length - 1)), y = (v) => 130 - (v / max) * 96;
    const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    const labels = ["Raw", "Age + hours", " + school", " + job"];
    return `<div class="stat-chart"><div class="chart-title">Adjusted gap as people become more alike</div>
      <svg viewBox="0 0 360 170" role="img" aria-label="Line chart showing the adjusted gender gap at four model steps">
        <line x1="42" y1="130" x2="316" y2="130" class="chart-axis"/>
        <polyline points="${points}" fill="none" stroke="var(--star)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        ${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="6" fill="var(--star)"/><text x="${x(i)}" y="${y(v) - 10}" text-anchor="middle" class="chart-value">${v.toFixed(1)}</text><text x="${x(i)}" y="153" text-anchor="middle">${labels[i]}</text>`).join("")}
        <text x="42" y="12" class="chart-note">gap in percentage points</text>
      </svg></div>`;
  }
  function educationChart(groups) {
    const values = groups.map((g) => g.gap * 100), max = Math.max(...values) * 1.15;
    const labels = ["School only", "Some college", "College degree", "Postgrad"];
    const x = (i) => 38 + i * 86, y = (v) => 138 - (v / max) * 100;
    return `<div class="stat-chart"><div class="chart-title">Adjusted gap by education group</div>
      <svg viewBox="0 0 390 185" role="img" aria-label="Bar chart showing adjusted gender gaps by education group">
        <line x1="30" y1="138" x2="372" y2="138" class="chart-axis"/>
        ${values.map((v, i) => `<rect x="${x(i)}" y="${y(v)}" width="54" height="${138 - y(v)}" rx="7" fill="var(--star)"/><text x="${x(i) + 27}" y="${y(v) - 7}" text-anchor="middle" class="chart-value">${v.toFixed(1)}</text><text x="${x(i) + 27}" y="154" text-anchor="middle">${labels[i].split(" ")[0]}</text><text x="${x(i) + 27}" y="170" text-anchor="middle">${labels[i].split(" ").slice(1).join(" ")}</text>`).join("")}
        <text x="30" y="12" class="chart-note">gap in percentage points</text>
      </svg></div>`;
  }

  function buildScenes() {
    const raw = R.raw, m = R.model;
    const ms = Math.round(raw.rate_male * 100), ws = Math.round(raw.rate_female * 100), gap = ms - ws;
    const first = R.stairs[0].gap * 100, last = R.stairs[R.stairs.length - 1].gap * 100;
    const who = gap > 0 ? "men" : gap < 0 ? "women" : "nobody";
    scenes = [];

    // 1. The story
    scenes.push({ html: `<h2>The Star Story</h2><div class="big">👩‍🏫 👨‍🔧 👩‍⚕️ 👨‍🍳</div>
      <p class="say">Grown-ups go to work. Some of them get <b>BIG pay</b>. When someone gets big pay, we give them a gold star ⭐.</p>
      <p class="say">Today we ask one question: <b>do men and women get stars the same?</b></p>
      <p class="say">We will count, shake a jar, play twins, and ask a Magic Helper (a smart computer)!</p>` });

    // 2. Count the stars
    scenes.push({ html: `<h2>Let's count the stars!</h2>
      <div class="teams">
        <div class="team men"><h3>👨 100 men</h3>${grid(raw.rate_male)}<div class="count">${ms} ⭐</div></div>
        <div class="team women"><h3>👩 100 women</h3>${grid(raw.rate_female)}<div class="count">${ws} ⭐</div></div>
      </div>
      ${rateChart(raw)}
      <p class="say">${gap === 0 ? "Both teams got the same number of stars." :
        `<b>${who === "men" ? "Men" : "Women"}</b> got more stars. The gap is about <b>${Math.abs(gap)} stars</b> out of 100.`}</p>` });

    // 3. Is it luck?
    const obs = raw.gap * 100, vals = R.shake.samples.map((v) => v * 100);
    const lo = Math.min(0, obs, ...vals), hi = Math.max(0, obs, ...vals), pad = (hi - lo) * 0.08;
    const a = lo - pad, b = hi + pad, pos = (v) => ((v - a) / (b - a)) * 100;
    scenes.push({ html: `<h2>Is it just luck? 🎲</h2>
      <p class="say">Let's play a trick. We put all the name tags "boy" and "girl" in a jar and <b>shake</b> them. Now the tags are mixed up by pure luck. Then we count the gap again!</p>
      <div class="jar" id="jar"><div class="zline" style="left:${pos(0)}%"></div>
        <div class="flag" style="left:${pos(obs)}%">🚩<small>REAL gap<br>${obs.toFixed(1)} ⭐</small></div>
        <div class="zero" style="left:${pos(0)}%">0 ⭐ (no gap)</div></div>
      ${permutationChart(raw, R.shake.samples)}
      <button class="btn alt" id="shake">Shake the name tags! 🎲</button>
      <p class="say" id="shakeMsg">Each blue dot is one shake. Press the button!</p>`,
      say: "Let's play a trick. We mix up the boy and girl name tags by pure luck, many times, and count the gap each time. Each blue dot is one shake. The red flag is the real gap.",
      after() {
        let shown = 0;
        $("#shake").onclick = () => {
          const jar = $("#jar"), end = Math.min(shown + 40, vals.length);
          for (let i = shown; i < end; i++) {
            const d = document.createElement("span");
            d.className = "dot";
            d.style.left = `calc(${pos(vals[i])}% - 7px)`;
            d.style.top = 70 + Math.random() * 100 + "px";
            d.style.animationDelay = (i - shown) * 15 + "ms";
            jar.appendChild(d);
          }
          shown = end;
          const big = vals.slice(0, shown).filter((v) => Math.abs(v) >= Math.abs(obs)).length;
          $("#shakeMsg").innerHTML = big === 0
            ? `We shook ${shown} times. 🎉 <b>Not one</b> shake made a gap as big as the real gap 🚩. So the gap is <b>NOT just luck</b>.`
            : `We shook ${shown} times. ${big} shake(s) were as big as the real gap 🚩. So luck <b>could</b> make a gap like this.`;
          if (shown >= vals.length) $("#shake").disabled = true;
        };
      } });

    // 4. Same age, school, job?
    scenes.push({ html: `<h2>What if everyone is alike? 👯</h2>
      <p class="say">Maybe men and women work different hours, or went to different school, or have different jobs. So we ask the computer: <b>what if we compare people who are alike?</b></p>
      ${bars(R.stairs.map((s) => ({ label: STEP[s.key], value: s.gap * 100 })))}
      ${staircaseChart(R.stairs)}
      <p class="say">${Math.abs(last) < 1 ? "Wow, the star gap almost went away!" :
        last >= 0.9 * first ? "Matching hardly changed the gap. Most of it is still there!" :
        "The gap got smaller, but it did <b>not</b> go away."}
        The gap that is left is the part that age, work hours, school and job <b>cannot explain</b>. Grown-ups must find out why.</p>`,
      say: "What if we compare people who are alike? Same age, same work hours, same school, same kind of job. Look at how the star gap changes in each bar." });

    // 5. Twin game with the ML model
    const rg = R.ranges, def = { age: Math.round(m.center.age_mean), hours: Math.round(m.center.hours_mean), edu: Math.round(m.center.edu_mean) };
    const occ = m.occupations.map((o) => `<option value="${o}"${o === "Sales" ? " selected" : ""}>${FP.jobName(o)}</option>`).join("");
    scenes.push({ html: `<h2>The Twin Game 👬 (Magic Helper)</h2>
      <p class="say">The <b>Magic Helper</b> is a computer that learned from lots of grown-ups. Make two twins who are exactly alike. Only one thing is different: boy or girl.</p>
      <div class="ctrl">
        <label>Age: <b id="vAge">${def.age}</b><input id="age" type="range" min="${rg.age[0]}" max="${rg.age[1]}" value="${def.age}"></label>
        <label>Work hours per week: <b id="vHours">${def.hours}</b><input id="hours" type="range" min="${rg.hours[0]}" max="${rg.hours[1]}" value="${def.hours}"></label>
        <label>Years of school: <b id="vEdu">${def.edu}</b><input id="edu" type="range" min="${rg.edu[0]}" max="${rg.edu[1]}" value="${def.edu}"><span class="hint">9 = finished high school, 13 = college degree</span></label>
        <label>Job:<select id="occ">${occ}</select></label>
      </div>
      <div class="teams"><div class="twin boy"><div class="face">👦</div><b>Boy twin</b><div class="meter" id="mB"></div><div class="count" id="sB"></div></div>
      <div class="twin girl"><div class="face">👧</div><b>Girl twin</b><div class="meter" id="mG"></div><div class="count" id="sG"></div></div></div>
      <p class="say" id="twinMsg"></p>
      <p class="hint">The helper guessed right ${Math.round(m.accuracy_holdout * 100)} times out of 100 on grown-ups it had never seen. (Just guessing "no star" for everyone would be right ${Math.round(m.accuracy_always_no * 100)} times.)
      It only copies patterns from old data. That does not mean the pattern is fair!</p>`,
      say: "Meet the Magic Helper, a computer that learned from lots of grown-ups. Make two twins who are exactly alike. Only boy or girl is different. Move the sliders and see how many stars the helper gives each twin.",
      after() {
        const meter = (n) => Array.from({ length: 100 }, (_, i) => `<span class="cell${i < n ? " on" : ""}"></span>`).join("");
        const update = () => {
          const inp = { age: +$("#age").value, hours: +$("#hours").value, edu: +$("#edu").value, occ: $("#occ").value };
          $("#vAge").textContent = inp.age; $("#vHours").textContent = inp.hours; $("#vEdu").textContent = inp.edu;
          const sb = FP.stars(FP.predict(m, { ...inp, female: 0 })), sg = FP.stars(FP.predict(m, { ...inp, female: 1 }));
          $("#mB").innerHTML = meter(sb); $("#mG").innerHTML = meter(sg);
          $("#sB").textContent = sb + " ⭐ out of 100"; $("#sG").textContent = sg + " ⭐ out of 100";
          const d = sb - sg;
          $("#twinMsg").innerHTML = Math.abs(d) >= 1
            ? `The helper gives the <b>${d > 0 ? "boy" : "girl"} twin about ${Math.abs(d)} more stars</b>. Same age, same hours, same school, same job. Only boy or girl changed!`
            : "The helper gives the twins <b>almost the same</b> stars here.";
        };
        ["age", "hours", "edu", "occ"].forEach((id) => ($("#" + id).oninput = update));
        update();
      } });

    // 6. Does school change it?
    const be = R.by_education.map((g) => ({ label: EDU[g.edu_group], value: g.gap * 100, n: g.n }));
    const mx = be.reduce((p, c) => (c.value > p.value ? c : p)), mn = be.reduce((p, c) => (c.value < p.value ? c : p));
    scenes.push({ html: `<h2>Does school change the gap? 🎓</h2>
      <p class="say">We ask the Magic Helper again, but now for different amounts of school. How many more stars would a man get than a woman who is alike in everything else?</p>
      ${bars(be)}
      ${educationChart(R.by_education)}
      <p class="say">The gap is biggest for <b>${mx.label}</b> (${mx.value.toFixed(1)} stars) and smallest for <b>${mn.label}</b> (${mn.value.toFixed(1)} stars).</p>`,
      say: "Does school change the gap? Look at the bars for each amount of school." });

    // 7. What we learned + grown-up corner
    const lines = [
      ["⭐", `About ${ms} out of 100 men and ${ws} out of 100 women got a star.`],
      ["🎲", raw.perm_p < 0.05 ? "Shaking the jar showed it is <b>not just luck</b>." : "Shaking the jar showed it <b>could be luck</b>."],
      ["👯", `Comparing alike people, the gap is still about <b>${last.toFixed(1)} stars</b>.`],
      ["🤖", "The Magic Helper only copies old patterns. <b>It cannot tell us what is fair.</b>"],
      ["🌍", "Fair pay for everyone is a goal for the whole world (SDG 5: Gender Equality)."] ];
    const I = R.interaction, rows = [
      [`About ${ms} of 100 men get a star`, `P(income > 50K | male) = ${raw.rate_male.toFixed(3)}`, "Rate in data"],
      [`About ${ws} of 100 women get a star`, `P(income > 50K | female) = ${raw.rate_female.toFixed(3)}`, "Rate in data"],
      [`Gap of about ${Math.abs(gap)} stars`, `Gap = ${raw.gap.toFixed(4)} (bootstrap 95% CI ${raw.gap_boot_ci95[0].toFixed(3)} to ${raw.gap_boot_ci95[1].toFixed(3)})`, "Difference of rates"],
      ["Shaking the jar (tags mixed by luck)", `Permutation p-value ${FP.formatP(raw.perm_p, raw.n_perm)} (${raw.n_perm} shuffles)`, "Permutation test"],
      ["Shaking only inside same school + job groups", `p-value ${FP.formatP(R.stratified.p, raw.n_perm)}; gap expected from the mix alone ${R.stratified.expected_gap_from_mix.toFixed(3)}`, "Stratified permutation"],
      ...R.stairs.map((s) => [STEP[s.key], `Gap ${pp(s.gap)} pts; odds ratio (women vs men) ${s.OR.toFixed(3)}, 95% CI ${s.ci_low.toFixed(3)} to ${s.ci_high.toFixed(3)}, p ${FP.pgen(s.p)}`, "Logistic regression, nested models"]),
      ["Twin game / Magic Helper", `Logistic regression with gender x education; hold-out AUC ${m.auc_holdout.toFixed(3)}, accuracy ${m.accuracy_holdout.toFixed(3)}`, "ML model, 80/20 split"],
      ["Does school change the gap?", `Odds ratio multiplier per school year ${I.OR_per_edu_year.OR.toFixed(3)} (95% CI ${I.OR_per_edu_year.ci_low.toFixed(3)} to ${I.OR_per_edu_year.ci_high.toFixed(3)}); likelihood-ratio p ${FP.pgen(I.LR_test.p)}`, "Interaction test"],
      ...R.or_by_education.map((g) => [`Odds ratio, ${EDU[g.edu_group]}`, `${g.OR.toFixed(3)} (95% CI ${g.ci_low.toFixed(3)} to ${g.ci_high.toFixed(3)})`, "Adjusted logistic regression"]) ];
    scenes.push({ html: `<h2>What did we learn? 🌈</h2>
      <div class="learn">${lines.map((l) => `<div class="item"><span class="e">${l[0]}</span><div>${l[1]}</div></div>`).join("")}</div>
      <details><summary>🧑‍🏫 Grown-up corner: match every kid sentence to its real number</summary>
        <table><tr><th>What the page says</th><th>Real statistic</th><th>Method</th></tr>
        ${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table>
        <p><b>Limits:</b> the data are from the 1994 US census and income is only above or below 50K. Results show a pattern, not the reason for it, and not proof of unfair treatment. Survey weights are not used.</p>
        <p>Sample: ${R.n.toLocaleString()} people (${R.n_female.toLocaleString()} women, ${R.n_male.toLocaleString()} men).</p></details>` ,
      say: "What did we learn? " + lines.map((l) => stripTags(l[1])).join(" ") });
  }

  function show() {
    const s = scenes[idx];
    $("#scene").innerHTML = s.html;
    if (s.after) s.after();
    $("#dots").innerHTML = scenes.map((_, i) => `<span class="${i === idx ? "on" : ""}"></span>`).join("");
    $("#back").disabled = idx === 0;
    $("#next").disabled = idx === scenes.length - 1;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  function go(d) { idx = Math.min(scenes.length - 1, Math.max(0, idx + d)); show(); }
  function read() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const s = scenes[idx];
    const u = new SpeechSynthesisUtterance(s.say || stripTags(s.html.split("<details>")[0]));
    u.rate = 0.9; u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }

  fetch("data/results.json").then((r) => r.json()).then((d) => {
    R = d;
    if (R.demo) $("#banner").innerHTML = '<div class="banner">🧪 PRACTICE NUMBERS (pretend data). Run <code>npm run train</code> on the real data to see real results.</div>';
    buildScenes(); show();
    $("#back").onclick = () => go(-1); $("#next").onclick = () => go(1); $("#read").onclick = read;
    document.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); });
  }).catch((e) => { $("#scene").textContent = "Could not load data/results.json. Run: npm run train (or npm run train:demo). " + e; });
})();
