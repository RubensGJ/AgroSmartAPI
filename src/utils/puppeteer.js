const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const PUPPETEER_CACHE_DIR = path.join(PROJECT_ROOT, ".cache", "puppeteer");
const DEFAULT_CHROME_ARGS = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;

const puppeteer = require("puppeteer");

// Converte flags textuais do .env para booleano no Puppeteer.
function parseBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase().trim();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function getChromeDiagnostics() {
  const diagnostics = {
    cacheDirectory: PUPPETEER_CACHE_DIR,
    executablePath: null,
    exists: false,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  };

  try {
    diagnostics.executablePath = puppeteer.executablePath();
    diagnostics.exists = fs.existsSync(diagnostics.executablePath);
  } catch (error) {
    diagnostics.error = error.message;
  }

  return diagnostics;
}

function formatChromeDiagnostics(diagnostics) {
  const executablePath = diagnostics.executablePath || "indisponivel";
  const exists = diagnostics.exists ? "sim" : "nao";
  const error = diagnostics.error ? `; erro=${diagnostics.error}` : "";

  return `cache=${diagnostics.cacheDirectory}; executablePath=${executablePath}; exists=${exists}; platform=${diagnostics.platform}; arch=${diagnostics.arch}; node=${diagnostics.nodeVersion}${error}`;
}

function assertChromeAvailable() {
  const diagnostics = getChromeDiagnostics();

  if (!diagnostics.executablePath || !diagnostics.exists) {
    const error = new Error(
      `Chrome do Puppeteer nao encontrado. ${formatChromeDiagnostics(diagnostics)}`
    );
    error.diagnostics = diagnostics;
    throw error;
  }

  return diagnostics;
}

function getPuppeteerLaunchOptions(options = {}) {
  const diagnostics = assertChromeAvailable();
  const extraArgs = Array.isArray(options.args) ? options.args : [];

  return {
    ...options,
    headless:
      options.headless === undefined
        ? parseBoolean(process.env.PUPPETEER_HEADLESS, true)
        : options.headless,
    executablePath: options.executablePath || diagnostics.executablePath,
    args: [...DEFAULT_CHROME_ARGS, ...extraArgs],
  };
}

module.exports = {
  PUPPETEER_CACHE_DIR,
  assertChromeAvailable,
  formatChromeDiagnostics,
  getChromeDiagnostics,
  getPuppeteerLaunchOptions,
  puppeteer,
};


// https://pptr.dev/troubleshooting