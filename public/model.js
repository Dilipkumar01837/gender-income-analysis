// Shared by the browser and the Node tests: runs the exported ML model (logistic regression).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FairPay = factory();
})(this, function () {
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  // input: {female (0/1), age, hours, edu (years of schooling), occ (job name)}
  function score(model, inp) {
    const c = model.coefs, m = model.center;
    const ac = (inp.age - m.age_mean) / 10, hc = (inp.hours - m.hours_mean) / 10, ec = inp.edu - m.edu_mean;
    let z = model.intercept + c.female * inp.female + c.age_c * ac + c.age_c2 * ac * ac +
            c.hours_c * hc + c.edu_c * ec + c["female:edu_c"] * inp.female * ec;
    if (inp.occ !== model.occ_reference && c["occ_" + inp.occ] !== undefined) z += c["occ_" + inp.occ];
    return z;
  }
  const predict = (model, inp) => sigmoid(score(model, inp));
  const stars = (p) => Math.round(p * 100);
  const formatP = (p, B) => (p <= 1.5 / (B + 1) ? "less than " + (1 / (B + 1)).toFixed(4) : p.toFixed(4));
  const pgen = (p) => (p < 0.001 ? "less than 0.001" : p.toFixed(3));

  const JOBS = { "Adm-clerical": "Office helper", "Craft-repair": "Fixer / builder",
    "Exec-managerial": "Boss / manager", "Farming-fishing": "Farmer / fisher",
    "Handlers-cleaners": "Cleaner / helper", "Machine-op-inspct": "Machine worker",
    "Other-service": "Service worker", "Priv-house-serv": "Home helper",
    "Prof-specialty": "Expert (doctor, teacher...)", "Protective-serv": "Safety helper",
    "Sales": "Seller", "Tech-support": "Tech helper", "Transport-moving": "Driver",
    "Armed-Forces": "Armed forces", "Other-rare": "Other jobs" };
  const jobName = (k) => JOBS[k] || k;

  return { sigmoid, score, predict, stars, formatP, pgen, jobName };
});
