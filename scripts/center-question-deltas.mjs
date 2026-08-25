import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const questionsPath = path.join(root, "content", "questions.md");
const markdown = fs.readFileSync(questionsPath, "utf8");
const sectionPattern = /(^## Q\d{2}｜[^\n]+\n)([\s\S]*?)(?=^## Q\d{2}｜|(?![\s\S]))/gm;
const vectorPattern = /(\s+`\[)([^\]]+)(\]`)/g;

function formatDelta(value) {
  if (Math.abs(value) < 1e-12) return "0";
  const formatted = Number(value.toFixed(12)).toString();
  return value > 0 ? `+${formatted}` : formatted;
}

let centeredQuestionCount = 0;
const centered = markdown.replace(sectionPattern, (section, heading, body) => {
  const vectors = [...body.matchAll(vectorPattern)].map((match) => (
    match[2].split(",").map((value) => Number(value.trim()))
  ));
  if (vectors.length === 0) return section;
  if (vectors.some((vector) => vector.length !== 5 || vector.some((value) => !Number.isFinite(value)))) {
    throw new Error(`${heading.trim()} contains an invalid coordinate vector`);
  }

  const means = Array(5).fill(0).map((_, axis) => (
    vectors.reduce((sum, vector) => sum + vector[axis], 0) / vectors.length
  ));
  let vectorIndex = 0;
  const centeredBody = body.replace(vectorPattern, (_, prefix, __, suffix) => {
    const vector = vectors[vectorIndex];
    vectorIndex += 1;
    const values = vector.map((value, axis) => formatDelta(value - means[axis]));
    return `${prefix}${values.join(", ")}${suffix}`;
  });
  centeredQuestionCount += 1;
  return `${heading}${centeredBody}`;
});

fs.writeFileSync(questionsPath, centered, "utf8");
console.log(`Centered ${centeredQuestionCount} questions.`);
