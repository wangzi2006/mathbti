import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (name) => fs.readFileSync(path.join(root, "content", name), "utf8");

function parseQuestions(markdown) {
  const questions = [];
  const sectionPattern = /^## Q(\d{2})｜([^\n]+)\n([\s\S]*?)(?=^## Q\d{2}｜|^---\s*$|(?![\s\S]))/gm;
  let section;
  while ((section = sectionPattern.exec(markdown)) !== null) {
    const [, number, title, body] = section;
    const optionPattern = /^- ([A-Z])\. (.+?)\s{2}\r?\n\s+`\[([^\]]+)\]`/gm;
    const options = [];
    let option;
    let firstOptionIndex = body.length;
    while ((option = optionPattern.exec(body)) !== null) {
      firstOptionIndex = Math.min(firstOptionIndex, option.index);
      options.push({
        label: option[1],
        text: option[2].trim(),
        delta: option[3].split(",").map((value) => Number(value.trim())),
      });
    }
    if (options.length < 3) throw new Error(`Question Q${number} has too few options`);
    const stem = body.slice(0, firstOptionIndex).trim();
    questions.push({ id: `q${number}`, title: title.trim(), stem, options });
  }
  return questions;
}

function parseResults(markdown, prototypes, definitions) {
  const sections = [];
  const sectionPattern = /^## (\d{2})｜([^\n]+)\n([\s\S]*?)(?=^## \d{2}｜|(?![\s\S]))/gm;
  let section;
  while ((section = sectionPattern.exec(markdown)) !== null) {
    const [, number, title, body] = section;
    const taglineMatch = body.match(/^\*\*(.+?)\*\*/m);
    if (!taglineMatch) throw new Error(`Result ${number} is missing a tagline`);
    const remainder = body.replace(taglineMatch[0], "").trim();
    const paragraphs = remainder.split(/\r?\n\s*\r?\n/).map((item) => item.trim()).filter(Boolean);
    sections.push({ number: Number(number), title: title.trim(), tagline: taglineMatch[1], portrait: paragraphs[0] ?? "", note: paragraphs[1] ?? "" });
  }
  if (sections.length !== prototypes.length) throw new Error("Result count does not match prototypes");
  return sections.map((section, index) => {
    const prototype = prototypes[index];
    const definition = definitions[prototype.id];
    if (!definition) throw new Error(`Missing definition for ${prototype.id}`);
    return { ...prototype, ...section, definition };
  });
}

function calculateBounds(questions) {
  const min = Array(7).fill(0);
  const max = Array(7).fill(0);
  for (const question of questions) {
    for (let axis = 0; axis < 7; axis += 1) {
      const values = question.options.map((option) => option.delta[axis]);
      min[axis] += Math.min(...values);
      max[axis] += Math.max(...values);
    }
  }
  return { min, max };
}

const questions = parseQuestions(read("questions.md"));
const prototypeData = JSON.parse(read("prototypes.json"));
const definitions = JSON.parse(read("definitions.json"));
const results = parseResults(read("results.md"), prototypeData.prototypes, definitions);
const data = {
  title: "MathBTI",
  subtitle: "无厘头数学人格测试",
  axisOrder: prototypeData.axisOrder,
  axisLabels: prototypeData.axisLabels,
  bounds: calculateBounds(questions),
  questions,
  results,
};

fs.writeFileSync(
  path.join(root, "site-data.js"),
  `window.MATHBTI_DATA = ${JSON.stringify(data, null, 2)};\n`,
  "utf8",
);

console.log(`Built ${questions.length} questions and ${results.length} results.`);
