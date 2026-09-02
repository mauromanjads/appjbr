const XLSX = require("xlsx");

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }
  return String(valor).trim();
}

function opcional(valor) {
  const t = texto(valor);
  return t || null;
}

function mapearCliente(fila, codigoCuenta) {
  const codigo = texto(fila.CCODIGOCLIENTE);
  const nombre = texto(fila.CRAZONSOCIAL);

  if (!codigo || !nombre) {
    return null;
  }

  return {
    codigo_cuenta: codigoCuenta,
    codigo,
    nombre,
    esta_activo: String(fila.CESTATUS) === "1",
    nit: opcional(fila.CRFC),
    telefono: opcional(fila.CWHATSAPP)
  };
}

function leerClientes(rutaExcel, codigoCuenta) {
  const libro = XLSX.readFile(rutaExcel);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

  const clientes = [];
  const omitidos = [];

  filas.forEach((fila, i) => {
    const cliente = mapearCliente(fila, codigoCuenta);
    if (!cliente) {
      omitidos.push({ fila: i + 2, motivo: "código o nombre vacíos" });
      return;
    }
    clientes.push(cliente);
  });

  return { clientes, omitidos };
}

module.exports = {
  leerClientes,
  mapearCliente
};
