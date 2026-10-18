// Arranca Chromium para las pruebas visuales. Si el navegador que espera Playwright no está instalado
// (p. ej. versión distinta en el entorno), usa CHROMIUM_PATH o el Chromium preinstalado.
const { chromium } = require('playwright');
const fs = require('fs');
module.exports = async () => {
  try { return await chromium.launch(); }
  catch (e) {
    const p = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find(x => x && fs.existsSync(x));
    if (!p) throw e;
    return chromium.launch({ executablePath: p });
  }
};
