import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TOKENS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../shared/css/tokens.css"
);

let resolvedTokenMap = null;

function parseCssCustomProperties(sourceText) {
  const tokenMap = new Map();
  const matcher = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let match;
  while ((match = matcher.exec(sourceText))) {
    tokenMap.set(match[1], match[2].trim());
  }
  return tokenMap;
}

function resolveCssValue(name, tokenMap, seen = new Set()) {
  const rawValue = tokenMap.get(name);
  if (!rawValue) return "";
  if (seen.has(name)) return rawValue;
  seen.add(name);
  const resolved = rawValue.replace(/var\(\s*--([a-z0-9-]+)\s*(?:,\s*([^)]+))?\)/gi, (_match, dependency, fallback = "") => {
    const dependencyValue = resolveCssValue(dependency, tokenMap, seen);
    if (dependencyValue) return dependencyValue;
    return String(fallback || "").trim();
  });
  seen.delete(name);
  return resolved.trim();
}

function getResolvedTokenMap() {
  if (resolvedTokenMap) return resolvedTokenMap;
  const sourceText = readFileSync(TOKENS_PATH, "utf8");
  const rawTokenMap = parseCssCustomProperties(sourceText);
  resolvedTokenMap = new Map();
  for (const name of rawTokenMap.keys()) {
    resolvedTokenMap.set(name, resolveCssValue(name, rawTokenMap));
  }
  return resolvedTokenMap;
}

export function styleToken(name, fallback = "") {
  return getResolvedTokenMap().get(String(name || "")) || fallback;
}

export const inlineTheme = Object.freeze({
  ink: styleToken("text"),
  inkStrong: styleToken("text-strong"),
  muted: styleToken("muted"),
  line: styleToken("line-soft"),
  bgStart: styleToken("surface-subtle"),
  bgEnd: styleToken("surface-muted"),
  cardBg: styleToken("white-alpha-98"),
  cardBorder: styleToken("line-soft"),
  shadow: styleToken("shadow"),
  buttonBg: styleToken("text-strong"),
  buttonText: styleToken("surface"),
  codeBg: styleToken("surface-muted"),
  errorText: styleToken("error-text"),
  errorBg: styleToken("surface-error"),
  errorBorder: styleToken("line-error")
});

export const pdfTheme = Object.freeze({
  surface: styleToken("surface"),
  surfaceMuted: styleToken("surface-muted"),
  surfaceSubtle: styleToken("surface-subtle"),
  surfaceSuccess: styleToken("surface-success"),
  line: styleToken("line-soft"),
  lineStrong: styleToken("line"),
  text: styleToken("text"),
  textStrong: styleToken("text-strong"),
  textMuted: styleToken("muted"),
  textMutedStrong: styleToken("text-muted-strong")
});

export const mailTheme = Object.freeze({
  text: styleToken("text")
});
