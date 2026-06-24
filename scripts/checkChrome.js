const {
  assertChromeAvailable,
  formatChromeDiagnostics,
  getChromeDiagnostics,
} = require("../src/utils/puppeteer");

function main() {
  try {
    const diagnostics = assertChromeAvailable();
    console.log(`[CHECK-CHROME] Chrome do Puppeteer disponivel. ${formatChromeDiagnostics(diagnostics)}`);
  } catch (error) {
    console.error(
      `[CHECK-CHROME] Chrome do Puppeteer indisponivel. ${formatChromeDiagnostics(
        error.diagnostics || getChromeDiagnostics()
      )}`
    );
    console.error(error.stack || error.message);
    process.exit(1);
  }
}

main();
