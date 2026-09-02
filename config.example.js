const path = require("path");

module.exports = {
  port: 3000,

  supabase: {
    url: "", // https://xxxxxxxx.supabase.co
    key: "", // service_role (secret)
    schema: "emp_jbr_cygnus_y9ihz"
  },

  codigoCuenta: "023WA",
  productosExcel: path.join(__dirname, "datos", "productos.xlsx"),
  clientesExcel: path.join(__dirname, "datos", "clientes.xlsx"),
  bodegasExcel: path.join(__dirname, "datos", "bodegas.xlsx")
};
