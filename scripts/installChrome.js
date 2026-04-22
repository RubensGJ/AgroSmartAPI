const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const puppeteer = require("puppeteer");

// Escreve mensagens simples do postinstall no console.
function log(message) {
  console.log(`[POSTINSTALL] ${message}`);
}

// Descobre o caminho do CLI interno do Puppeteer usado na instalacao do Chrome.
function getPuppeteerCliPath() {
  const packageJsonPath = require.resolve("puppeteer/package.json");
  return path.join(path.dirname(packageJsonPath), "lib", "cjs", "puppeteer", "node", "cli.js");
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

// Executa o comando oficial do Puppeteer para instalar o Chrome.
function installChrome() {
  const cliPath = getPuppeteerCliPath();
  const result = spawnSync(process.execPath, [cliPath, "browsers", "install", "chrome"], {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

// Evita reinstalar o Chrome quando ele ja esta pronto e corrige cache quebrado.
function main() {
  const executablePath = puppeteer.executablePath();

  if (fs.existsSync(executablePath)) {
    log("Chrome do Puppeteer ja esta disponivel.");
    return;
  }

  removeBrokenBrowserFolder(executablePath);
  log("Instalando Chrome do Puppeteer.");
  installChrome();
}

main();
