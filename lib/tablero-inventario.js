const supabase = require("./supabase");

const SKU_MAX = 601000024;

function diaSiguiente(fecha) {
  const d = new Date(fecha + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function fechasDesdeQuery(query) {
  const m = String(query || "").match(
    /BETWEEN\s+'(\d{4}-\d{2}-\d{2})'\s+AND\s+'(\d{4}-\d{2}-\d{2})'/i
  );
  if (!m) {
    return null;
  }
  return { fechaInicio: m[1], fechaFin: m[2] };
}

function acumular(mapa, id, campos) {
  if (!id) {
    return;
  }
  if (!mapa.has(id)) {
    mapa.set(id, {
      cantidad_compra: 0,
      costo_total_compra: 0,
      cantidad_venta: 0,
      venta_total: 0,
      cantidad_merma: 0,
      costo_total_merma: 0,
      existencia_actual: 0,
      valor_inventario: 0
    });
  }
  const row = mapa.get(id);
  Object.keys(campos).forEach(function (k) {
    row[k] += campos[k] || 0;
  });
}

function n(valor) {
  const x = Number(valor);
  return Number.isFinite(x) ? x : 0;
}

async function lineasPorOrdenes(config, tablaLinea, selectLinea, ids) {
  const all = [];
  const trozo = 80;
  const campo =
    tablaLinea === "orden_venta_linea" ? "id_orden_venta" : "id_orden_compra";
  const lotes = [];
  for (let i = 0; i < ids.length; i += trozo) {
    lotes.push(ids.slice(i, i + trozo));
  }

  const paralelo = 6;
  for (let i = 0; i < lotes.length; i += paralelo) {
    const grupo = await Promise.all(
      lotes.slice(i, i + paralelo).map(function (lote) {
        return supabase.seleccionar(
          config,
          tablaLinea,
          "select=" + selectLinea + "&" + campo + "=in.(" + lote.join(",") + ")"
        );
      })
    );
    grupo.forEach(function (chunk) {
      all.push.apply(all, chunk);
    });
  }
  return all;
}

async function consultarTablero(config, fechaInicio, fechaFin) {
  const cuenta = config.codigoCuenta;
  const finExclusivo = diaSiguiente(fechaFin);

  const [encVentas, encCompras, mermas, stock, productos] = await Promise.all([
    supabase.seleccionar(
      config,
      "orden_venta",
      "select=id_orden_venta&codigo_cuenta=eq." +
        encodeURIComponent(cuenta) +
        "&fecha_pedido=gte." +
        fechaInicio +
        "&fecha_pedido=lte." +
        fechaFin
    ),
    supabase.seleccionar(
      config,
      "orden_compra",
      "select=id_orden_compra&codigo_cuenta=eq." +
        encodeURIComponent(cuenta) +
        "&fecha_emision=gte." +
        fechaInicio +
        "&fecha_emision=lte." +
        fechaFin
    ),
    supabase.seleccionar(
      config,
      "movimiento_inventario",
      "select=id_producto,cantidad,costo_unitario" +
        "&codigo_cuenta=eq." +
        encodeURIComponent(cuenta) +
        "&tipo_movimiento=eq.merma" +
        "&created_at=gte." +
        fechaInicio +
        "&created_at=lt." +
        finExclusivo
    ),
    supabase.seleccionar(
      config,
      "warehouse_state",
      "select=id_producto,cantidad,lote(costo_unitario),bodega!inner(codigo)" +
        "&codigo_cuenta=eq." +
        encodeURIComponent(cuenta) +
        "&bodega.codigo=eq.8"
    ),
    supabase.seleccionar(
      config,
      "producto",
      "select=id_producto,sku,descripcion,unidad_medida&codigo_cuenta=eq." +
        encodeURIComponent(cuenta)
    )
  ]);

  const [ventas, compras] = await Promise.all([
    lineasPorOrdenes(
      config,
      "orden_venta_linea",
      "id_producto,cantidad_despachada,precio_unitario,importe_total",
      encVentas.map(function (r) {
        return r.id_orden_venta;
      })
    ),
    lineasPorOrdenes(
      config,
      "orden_compra_linea",
      "id_producto,cantidad,precio_unitario,importe_total",
      encCompras.map(function (r) {
        return r.id_orden_compra;
      })
    )
  ]);

  const mapa = new Map();

  compras.forEach(function (fila) {
    acumular(mapa, fila.id_producto, {
      cantidad_compra: n(fila.cantidad),
      costo_total_compra:
        fila.importe_total != null
          ? n(fila.importe_total)
          : n(fila.cantidad) * n(fila.precio_unitario)
    });
  });

  ventas.forEach(function (fila) {
    acumular(mapa, fila.id_producto, {
      cantidad_venta: n(fila.cantidad_despachada),
      venta_total:
        fila.importe_total != null
          ? n(fila.importe_total)
          : n(fila.cantidad_despachada) * n(fila.precio_unitario)
    });
  });

  mermas.forEach(function (fila) {
    acumular(mapa, fila.id_producto, {
      cantidad_merma: n(fila.cantidad),
      costo_total_merma: n(fila.cantidad) * n(fila.costo_unitario)
    });
  });

  stock.forEach(function (fila) {
    const costo = fila.lote && fila.lote.costo_unitario != null ? n(fila.lote.costo_unitario) : 0;
    acumular(mapa, fila.id_producto, {
      existencia_actual: n(fila.cantidad),
      valor_inventario: costo
    });
  });

  const porId = new Map();
  productos.forEach(function (p) {
    porId.set(p.id_producto, p);
  });

  const rows = [];
  mapa.forEach(function (vals, id) {
    const p = porId.get(id);
    if (!p || !/^\d+$/.test(String(p.sku || ""))) {
      return;
    }
    if (Number(p.sku) >= SKU_MAX) {
      return;
    }
    rows.push({
      IdProducto: p.id_producto,
      CodigoProducto: p.sku,
      NombreProducto: p.descripcion,
      Unidad: p.unidad_medida,
      CantidadCompra: vals.cantidad_compra,
      CantidadVenta: vals.cantidad_venta,
      CantidadMerma: vals.cantidad_merma,
      ExistenciaActual: vals.existencia_actual,
      CostoTotalCompra: vals.costo_total_compra,
      VentaTotal: vals.venta_total,
      CostoTotalMerma: vals.costo_total_merma,
      ValorInventario: vals.valor_inventario,
      CostoUnitario: vals.cantidad_compra
        ? vals.costo_total_compra / vals.cantidad_compra
        : null,
      VentaUnitaria: vals.cantidad_venta ? vals.venta_total / vals.cantidad_venta : null,
      MermaDesecho: vals.cantidad_compra
        ? vals.cantidad_merma / vals.cantidad_compra
        : null
    });
  });

  rows.sort(function (a, b) {
    return String(a.CodigoProducto).localeCompare(String(b.CodigoProducto), "es", {
      numeric: true
    });
  });

  return rows;
}

const COLS_TABLERO = {
  idproducto: "IdProducto",
  codigoproducto: "CodigoProducto",
  nombreproducto: "NombreProducto",
  unidad: "Unidad",
  cantidadcompra: "CantidadCompra",
  cantidadventa: "CantidadVenta",
  cantidadmerma: "CantidadMerma",
  existenciaactual: "ExistenciaActual",
  costototalcompra: "CostoTotalCompra",
  ventatotal: "VentaTotal",
  costototalmerma: "CostoTotalMerma",
  valorinventario: "ValorInventario",
  costounitario: "CostoUnitario",
  ventaunitaria: "VentaUnitaria",
  mermadesecho: "MermaDesecho"
};

function normalizarFilasRpc(filas) {
  return (filas || []).map(function (fila) {
    const out = {};
    Object.keys(fila).forEach(function (k) {
      const dest = COLS_TABLERO[k.toLowerCase()] || k;
      out[dest] = fila[k];
    });
    return out;
  });
}

async function consultarPorRpc(config, fechaInicio, fechaFin) {
  const response = await fetch(
    supabase.baseUrl(config) + "/rest/v1/rpc/get_ventas_compras_inventario",
    {
      method: "POST",
      headers: supabase.headers(config),
      body: JSON.stringify({
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin
      })
    }
  );

  if (!response.ok) {
    throw new Error(await supabase.leerError(response));
  }

  return normalizarFilasRpc(await response.json());
}

async function consultarTableroRapido(config, fechaInicio, fechaFin) {
  try {
    return await consultarPorRpc(config, fechaInicio, fechaFin);
  } catch (error) {
    const msg = String(error.message || "");
    if (msg.indexOf("PGRST202") !== -1 || msg.indexOf("Could not find the function") !== -1) {
      return consultarTablero(config, fechaInicio, fechaFin);
    }
    throw error;
  }
}

module.exports = {
  fechasDesdeQuery,
  consultarTablero,
  consultarTableroRapido
};
