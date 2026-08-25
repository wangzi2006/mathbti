import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const source = fs.readFileSync(path.join(root, "site-data.js"), "utf8");
const data = JSON.parse(source.replace(/^window\.MATHBTI_DATA\s*=\s*/, "").replace(/;\s*$/, ""));
const results = data.results.filter((result) => !result.special);
const sampleCount = Number(process.argv[2] || 300_000);

let randomState = 0x6d2b79f5;
function random() {
  randomState += 0x6d2b79f5;
  let value = randomState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

function normal() {
  const first = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * random());
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function scoresFromRaw(raw) {
  return raw.map((value, axis) => {
    if (value < 0) return clamp(value / Math.abs(data.bounds.min[axis]), -1, 0);
    if (value > 0) return clamp(value / data.bounds.max[axis], 0, 1);
    return 0;
  });
}

function distances(scores) {
  return results.map((result) => result.coordinates.reduce(
    (sum, coordinate, axis) => sum + ((scores[axis] - coordinate) ** 2),
    0,
  ) + (Number(result.selectionOffset) || 0));
}

function closestIndex(scores) {
  const allDistances = distances(scores);
  let best = 0;
  for (let index = 1; index < allDistances.length; index += 1) {
    if (allDistances[index] < allDistances[best]) best = index;
  }
  return best;
}

function chooseUniform(question) {
  return Math.floor(random() * question.options.length);
}

function chooseCoherent(question, traits) {
  const ranges = traits.map((_, axis) => {
    const values = question.options.map((option) => option.delta[axis]);
    return Math.max(...values) - Math.min(...values);
  });
  let bestOption = 0;
  let bestUtility = -Infinity;
  question.options.forEach((option, optionIndex) => {
    const preference = option.delta.reduce((sum, value, axis) => (
      sum + (ranges[axis] === 0 ? 0 : traits[axis] * value / ranges[axis])
    ), 0);
    const gumbelNoise = -Math.log(-Math.log(Math.max(random(), Number.EPSILON))) * 0.65;
    const utility = preference + gumbelNoise;
    if (utility > bestUtility) {
      bestUtility = utility;
      bestOption = optionIndex;
    }
  });
  return bestOption;
}

function simulate(mode) {
  const counts = Array(results.length).fill(0);
  const axisSum = Array(data.axisOrder.length).fill(0);
  const axisSquareSum = Array(data.axisOrder.length).fill(0);
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const traits = mode === "coherent"
      ? data.axisOrder.map(() => clamp(normal() * 0.65, -1, 1))
      : null;
    const raw = Array(data.axisOrder.length).fill(0);
    for (const question of data.questions) {
      const optionIndex = mode === "coherent"
        ? chooseCoherent(question, traits)
        : chooseUniform(question);
      question.options[optionIndex].delta.forEach((value, axis) => { raw[axis] += value; });
    }
    const scores = scoresFromRaw(raw);
    scores.forEach((score, axis) => {
      axisSum[axis] += score;
      axisSquareSum[axis] += score * score;
    });
    counts[closestIndex(scores)] += 1;
  }
  return {
    counts,
    means: axisSum.map((sum) => sum / sampleCount),
    standardDeviations: axisSquareSum.map((sum, axis) => {
      const mean = axisSum[axis] / sampleCount;
      return Math.sqrt(Math.max(0, (sum / sampleCount) - (mean * mean)));
    }),
  };
}

function assignmentMargin(scores, targetIndex) {
  const allDistances = distances(scores);
  let closestOther = Infinity;
  allDistances.forEach((distance, index) => {
    if (index !== targetIndex) closestOther = Math.min(closestOther, distance);
  });
  return allDistances[targetIndex] - closestOther;
}

function targetedReachability(targetIndex) {
  let bestMargin = Infinity;
  let bestDistance = Infinity;
  const restarts = 24;
  const steps = 2400;
  for (let restart = 0; restart < restarts; restart += 1) {
    const answers = data.questions.map(chooseUniform);
    const raw = Array(data.axisOrder.length).fill(0);
    answers.forEach((answer, questionIndex) => {
      data.questions[questionIndex].options[answer].delta.forEach((value, axis) => { raw[axis] += value; });
    });
    let scores = scoresFromRaw(raw);
    let margin = assignmentMargin(scores, targetIndex);
    for (let step = 0; step < steps; step += 1) {
      if (margin < -1e-10) {
        const distance = distances(scores)[targetIndex];
        return { reachable: true, margin, distance };
      }
      const questionIndex = Math.floor(random() * data.questions.length);
      const question = data.questions[questionIndex];
      const previousAnswer = answers[questionIndex];
      let nextAnswer = Math.floor(random() * question.options.length);
      if (nextAnswer === previousAnswer) nextAnswer = (nextAnswer + 1) % question.options.length;
      const previousDelta = question.options[previousAnswer].delta;
      const nextDelta = question.options[nextAnswer].delta;
      const nextRaw = raw.map((value, axis) => value - previousDelta[axis] + nextDelta[axis]);
      const nextScores = scoresFromRaw(nextRaw);
      const nextMargin = assignmentMargin(nextScores, targetIndex);
      const temperature = 0.08 * (1 - (step / steps)) + 0.002;
      if (nextMargin < margin || random() < Math.exp((margin - nextMargin) / temperature)) {
        answers[questionIndex] = nextAnswer;
        raw.splice(0, raw.length, ...nextRaw);
        scores = nextScores;
        margin = nextMargin;
      }
      if (margin < bestMargin) {
        bestMargin = margin;
        bestDistance = distances(scores)[targetIndex];
      }
    }
  }
  return { reachable: bestMargin < -1e-10, margin: bestMargin, distance: bestDistance };
}

function summarize(label, simulation) {
  const shares = simulation.counts.map((count) => count / sampleCount);
  const expected = 1 / results.length;
  const variance = shares.reduce((sum, share) => sum + ((share - expected) ** 2), 0) / results.length;
  const sorted = results.map((result, index) => ({
    name: result.name,
    count: simulation.counts[index],
    share: shares[index],
  })).sort((left, right) => right.share - left.share);
  console.log(`\n${label}`);
  console.log(`axis means: ${simulation.means.map((value) => value.toFixed(3)).join(", ")}`);
  console.log(`axis sd:    ${simulation.standardDeviations.map((value) => value.toFixed(3)).join(", ")}`);
  console.log(`share CV:   ${(Math.sqrt(variance) / expected).toFixed(3)}`);
  console.log("highest:");
  sorted.slice(0, 8).forEach((item) => console.log(`  ${(item.share * 100).toFixed(3)}%  ${item.name}`));
  console.log("lowest:");
  sorted.slice(-12).reverse().forEach((item) => console.log(`  ${(item.share * 100).toFixed(3)}%  ${item.name}`));
}

console.log(`samples per model: ${sampleCount}`);
console.log(`ordinary results: ${results.length}`);
const uniform = simulate("uniform");
const coherent = simulate("coherent");
summarize("uniform independent answers", uniform);
summarize("coherent latent-trait answers", coherent);

console.log("\ntargeted reachability:");
const reachability = results.map((result, index) => ({ result, ...targetedReachability(index) }));
reachability.forEach(({ result, reachable, margin, distance }) => {
  console.log(`  ${reachable ? "yes" : "NO "}  ${result.name}  margin=${margin.toFixed(5)} distance=${distance.toFixed(5)}`);
});

console.log("\ncombined result shares:");
results.map((result, index) => ({
  name: result.name,
  uniform: uniform.counts[index] / sampleCount,
  coherent: coherent.counts[index] / sampleCount,
  reachable: reachability[index].reachable,
})).sort((left, right) => left.coherent - right.coherent).forEach((item) => {
  console.log(`  ${item.name}\t${(item.uniform * 100).toFixed(4)}%\t${(item.coherent * 100).toFixed(4)}%\t${item.reachable ? "yes" : "NO"}`);
});
