const path = require("path");

try {
  require("dotenv").config();
} catch (_error) {
  // dotenv es opcional en Vercel (ahí las variables ya vienen inyectadas)
}

module.exports = {
  port: Number(process.env.PORT) || 3000,

  supabase: {
    url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    key: process.env.SUPABASE_KEY || "",
    schema: process.env.SUPABASE_SCHEMA || "emp_jbr_cygnus_y9ihz"
  },

  codigoCuenta: process.env.CODIGO_CUENTA || "023WA",
  productosExcel: path.join(__dirname, "datos", "productos.xlsx"),
  clientesExcel: path.join(__dirname, "datos", "clientes.xlsx"),
  bodegasExcel: path.join(__dirname, "datos", "bodegas.xlsx")
};
