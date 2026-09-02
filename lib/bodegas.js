const XLSX = require("xlsx");

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }
  return String(valor).trim();
}

function tipoDesdeNombre(nombre) {
  const n = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (n.indexOf("consignacion") !== -1 || n.indexOf("terceros") !== -1) {
    return "externa";
  }

  return "interna";
}

function mapearBodega(fila, codigoCuenta) {
  const codigo = texto(fila.CCODIGOALMACEN);
  const nombre = texto(fila.CNOMBREALMACEN);

  if (!codigo || !nombre) {
    return null;
  }

  return {
    codigo_cuenta: codigoCuenta,
    codigo,
    nombre,
    esta_activa: true,
    tipo: tipoDesdeNombre(nombre)
  };
}

function leerBodegas(rutaExcel, codigoCuenta) {
  const libro = XLSX.readFile(rutaExcel);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

  const bodegas = [];
  const omitidos = [];

  filas.forEach((fila, i) => {
    const bodega = mapearBodega(fila, codigoCuenta);
    if (!bodega) {
      omitidos.push({ fila: i + 2, motivo: "código o nombre vacíos" });
      return;
    }
    bodegas.push(bodega);
  });

  return { bodegas, omitidos };
}

module.exports = {
  leerBodegas,
  mapearBodega
};
