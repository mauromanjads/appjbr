const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const config = require("./config");

const RAIZ = __dirname;
const PAGINAS_DEL_MENU = [
  "public/index.html",
  "public/dashboard.html",
  "public/dashboard-supabase.html",
  "public/migracion.html"
];

function leerTexto(rutaRelativa) {
  return fs.readFileSync(path.join(RAIZ, rutaRelativa), "utf8");
}

function navegacionDe(html) {
  const inicio = html.indexOf("<nav");
  const fin = html.indexOf("</nav>");
  assert.ok(inicio !== -1 && fin > inicio, "la pagina no tiene nav");
  return html.slice(inicio, fin);
}

test("la configuracion no expone sqlApiUrl", () => {
  assert.equal(Object.hasOwn(config, "sqlApiUrl"), false);
});

test("el menu de las cuatro paginas no enlaza migracion", () => {
  for (const pagina of PAGINAS_DEL_MENU) {
    const navegacion = navegacionDe(leerTexto(pagina));
    assert.equal(navegacion.includes("migracion.html"), false, pagina);
  }
});

test("el explorer usa el titulo compacto y el area de consulta alta", () => {
  const explorer = leerTexto("public/index.html");
  const estilos = leerTexto("public/css/polaria.css");

  assert.match(explorer, /<h1 class="titulo-explorer">SQL Explorer<\/h1>/);
  assert.equal(explorer.includes("Consulta de información SQL Server"), false);
  assert.match(estilos, /\.titulo-explorer\s*\{[^}]*font-size:\s*22px;/);
  assert.match(estilos, /textarea\s*\{[^}]*min-height:\s*420px;/);
});
