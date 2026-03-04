const { join } = require("path");

module.exports = {
  // Mantem o browser no diretorio do projeto (importante em plataformas como Render).
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
