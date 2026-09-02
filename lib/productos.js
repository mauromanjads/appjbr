const XLSX = require("xlsx");

function texto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }
  return String(valor).trim();
}

function categoriaDesdeTipo(tipo) {
  if (String(tipo) === "3") {
    return "servicio";
  }
  return "venta";
}

function mapearProducto(fila, codigoCuenta) {
  const sku = texto(fila.CCODIGOPRODUCTO);
  const descripcion = texto(fila.CNOMBREPRODUCTO);
  const unidad = texto(fila.CABREVIATURA) || "UNO";

  if (!sku || !descripcion) {
    return null;
  }

  const cid = Number(fila.CIDPRODUCTO);
  const tipo = Number(fila.CTIPOPRODUCTO);
  const precio = Number(fila.CPRECIO1);

  return {
    codigo_cuenta: codigoCuenta,
    sku,
    descripcion,
    unidad_medida: unidad,
    unidad_visualizacion: unidad,
    requiere_lote: false,
    esta_activo: String(fila.CSTATUSPRODUCTO) === "1",
    es_primario: true,
    es_secundario: false,
    categoria: categoriaDesdeTipo(fila.CTIPOPRODUCTO),
    precio: Number.isFinite(precio) ? precio : 0,
    metadatos_catalogo: {
      cid_producto: Number.isFinite(cid) ? cid : null,
      tipo_producto: Number.isFinite(tipo) ? tipo : null,
      unidad_nombre: texto(fila.CNOMBREUNIDAD) || null
    }
  };
}

function leerProductos(rutaExcel, codigoCuenta) {
  const libro = XLSX.readFile(rutaExcel);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

  const productos = [];
  const omitidos = [];

  filas.forEach((fila, i) => {
    const producto = mapearProducto(fila, codigoCuenta);
    if (!producto) {
      omitidos.push({ fila: i + 2, motivo: "sku o descripción vacíos" });
      return;
    }
    productos.push(producto);
  });

  return { productos, omitidos };
}

module.exports = {
  leerProductos,
  mapearProducto
};
