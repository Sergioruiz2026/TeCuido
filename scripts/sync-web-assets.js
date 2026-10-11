const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const sourceDirectory = path.join(projectRoot, 'stitch_saludf_cil_asistente_m_dico');
const appDirectory = path.join(projectRoot, 'app');

function visitHtml(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visitHtml(entryPath);
      continue;
    }
    if (!entry.isFile() || entry.name !== 'code.html') continue;

    let html = fs.readFileSync(entryPath, 'utf8');
    if (!/<meta\s+charset=["']?utf-8/i.test(html)) {
      throw new Error(`Missing UTF-8 charset declaration in ${entryPath}`);
    }

    html = html
      .replaceAll("fetch('/api/", "fetch((window.TECUIDO_API_URL || '') + '/api/")
      .replaceAll("fetch('http://localhost:3000/api/", "fetch((window.TECUIDO_API_URL || '') + '/api/");

    if (!html.includes('src="../config.js"')) {
      html = html.replace(/<\/head>/i, '<script src="../config.js"></script></head>');
    }

    fs.writeFileSync(entryPath, html, 'utf8');
  }
}

if (!fs.existsSync(sourceDirectory)) {
  throw new Error(`HTML source directory not found: ${sourceDirectory}`);
}

fs.cpSync(sourceDirectory, appDirectory, { recursive: true });
visitHtml(appDirectory);
