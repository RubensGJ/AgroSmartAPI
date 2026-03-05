const { join } = require("path");

module.exports = {
  // Mantem o browser dentro do projeto para ficar disponivel no runtime do Render.
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
