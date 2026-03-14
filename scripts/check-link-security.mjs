import fs from "node:fs";

const violations = [];

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function checkBlankLinks(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const anchorRegex = /<a\b[^>]*\btarget\s*=\s*"_blank"[^>]*>/gi;

  for (const match of content.matchAll(anchorRegex)) {
    const tag = match[0];
    const line = lineNumberForIndex(content, match.index ?? 0);
    const relMatch = tag.match(/\brel\s*=\s*"([^"]*)"/i);

    if (!relMatch) {
      violations.push(`${filePath}:${line} <a target="_blank"> missing rel=\"noopener noreferrer\"`);
      continue;
    }

    const relValue = relMatch[1].toLowerCase();
    if (!relValue.includes("noopener") || !relValue.includes("noreferrer")) {
      violations.push(`${filePath}:${line} <a target="_blank"> rel must include both noopener and noreferrer`);
    }
  }
}

function splitTopLevelArgs(argString) {
  const args = [];
  let current = "";
  let depth = 0;
  let quote = null;

  for (let i = 0; i < argString.length; i += 1) {
    const ch = argString[i];
    const prev = argString[i - 1];

    if (quote) {
      current += ch;
      if (ch === quote && prev !== "\\") {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth -= 1;
      current += ch;
      continue;
    }

    if (ch === "," && depth === 0) {
      args.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function checkWindowOpen(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const openRegex = /window\.open\s*\(([^)]*)\)/g;

  for (const match of content.matchAll(openRegex)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    const args = splitTopLevelArgs(match[1]);

    if (args.length < 3) {
      violations.push(`${filePath}:${line} window.open must include third argument with noopener,noreferrer`);
      continue;
    }

    const thirdArg = args[2].toLowerCase();
    if (!thirdArg.includes("noopener") || !thirdArg.includes("noreferrer")) {
      violations.push(`${filePath}:${line} window.open third argument must include both noopener and noreferrer`);
    }
  }
}

checkBlankLinks("index.html");
checkWindowOpen("index.html");
checkWindowOpen("ui/designview.js");

if (violations.length > 0) {
  console.error("❌ Link security checks failed:\n");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("✅ Link security checks passed");
