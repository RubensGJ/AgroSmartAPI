const fs = require("fs");
const path = require("path");
const {
  Browser,
  detectBrowserPlatform,
  install,
  makeProgressCallback,
  resolveBuildId,
} = require("@puppeteer/browsers");
const { PUPPETEER_REVISIONS } = require("puppeteer-core/internal/revisions.js");
const {
  PUPPETEER_CACHE_DIR,
  assertChromeAvailable,
  formatChromeDiagnostics,
  getChromeDiagnostics,
} = require("../src/utils/puppeteer");

// Escreve mensagens simples do postinstall no console.
function log(message) {
  console.log(`[POSTINSTALL] ${message}`);
}

function logDiagnostics(prefix) {
  log(`${prefix}: ${formatChromeDiagnostics(getChromeDiagnostics())}`);
}

// Remove o cache quebrado quando a pasta existe, mas o executavel nao.
function removeBrokenBrowserFolder(executablePath) {
  const browserFolder = path.dirname(path.dirname(executablePath));

  if (!fs.existsSync(browserFolder)) {
    return;
  }

  log(`Cache incompleto detectado em ${browserFolder}. Removendo pasta corrompida.`);
  fs.rmSync(browserFolder, { recursive: true, force: true });
}

// Instala exatamente a revisao de Chrome esperada pela versao atual do Puppeteer.
async function installChrome() {
  const platform = detectBrowserPlatform();

  if (!platform) {
    throw new Error("Plataforma atual nao suportada pelo Puppeteer.");
  }

  const unresolvedBuildId = PUPPETEER_REVISIONS[Browser.CHROME];
  const buildId = await resolveBuildId(Browser.CHROME, platform, unresolvedBuildId);
  const result = await install({
    browser: Browser.CHROME,
    cacheDir: PUPPETEER_CACHE_DIR,
    platform,
    buildId,
    buildIdAlias: buildId !== unresolvedBuildId ? unresolvedBuildId : undefined,
    downloadProgressCallback: makeProgressCallback(Browser.CHROME, buildId),
  });

  log(`Chrome ${result.buildId} instalado em ${result.path}.`);
}

// Evita reinstalar o Chrome quando ele ja esta pronto e corrige cache quebrado.
async function main() {
  const diagnostics = getChromeDiagnostics();
  logDiagnostics("Diagnostico inicial do Chrome");

  if (diagnostics.exists) {
    log("Chrome do Puppeteer ja esta disponivel.");
    assertChromeAvailable();
    logDiagnostics("Diagnostico final do Chrome");
    return;
  }

  if (diagnostics.executablePath) {
    removeBrokenBrowserFolder(diagnostics.executablePath);
  }

  log("Instalando Chrome do Puppeteer.");
  await installChrome();
  assertChromeAvailable();
  logDiagnostics("Diagnostico final do Chrome");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
