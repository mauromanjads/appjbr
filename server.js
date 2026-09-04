const path = require("path");
const fs = require("fs");
const express = require("express");
const config = require("./config");
const supabase = require("./lib/supabase");
const { leerProductos } = require("./lib/productos");
const { leerClientes } = require("./lib/clientes");
const { leerBodegas } = require("./lib/bodegas");
const { fechasDesdeQuery, consultarTableroRapido } = require("./lib/tablero-inventario");
// migrarFacturas y migrarCompras se cargan de forma lazy dentro de cada ruta
// porque estos módulos son solo locales y no existen en producción (Vercel)

const app = express();
const LOTE = 100;

app.use(express.json());

app.post("/api/conectar", async (_req, res) => {
  const { url, key, schema } = config.supabase;

  if (!url || !key) {
    return res.status(500).json({
      ok: false,
      error: "Faltan SUPABASE_URL o SUPABASE_KEY en las variables de entorno"
    });
  }

  try {
    const response = await fetch(supabase.baseUrl(config) + "/rest/v1/", {
      headers: supabase.headers(config, {
        Accept: "application/openapi+json"
      })
    });

    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({
        ok: false,
        error: "La clave fue rechazada. Revisa SUPABASE_KEY."
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: await supabase.leerError(response)
      });
    }

    return res.json({
      ok: true,
      schema
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/migrar/productos", async (_req, res) => {
  try {
    if (!fs.existsSync(config.productosExcel)) {
      return res.status(400).json({
        ok: false,
        error: "No está el Excel en datos/productos.xlsx"
      });
    }

    const { productos, omitidos } = leerProductos(
      config.productosExcel,
      config.codigoCuenta
    );

    for (let i = 0; i < productos.length; i += LOTE) {
      await supabase.upsert(
        config,
        "producto",
        productos.slice(i, i + LOTE),
        "codigo_cuenta,sku"
      );
    }

    return res.json({
      ok: true,
      total: productos.length,
      omitidos: omitidos.length,
      codigo_cuenta: config.codigoCuenta
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/migrar/clientes", async (_req, res) => {
  try {
    if (!fs.existsSync(config.clientesExcel)) {
      return res.status(400).json({
        ok: false,
        error: "No está el Excel en datos/clientes.xlsx"
      });
    }

    const { clientes, omitidos } = leerClientes(
      config.clientesExcel,
      config.codigoCuenta
    );

    for (let i = 0; i < clientes.length; i += LOTE) {
      await supabase.upsert(
        config,
        "cliente",
        clientes.slice(i, i + LOTE),
        "codigo_cuenta,codigo"
      );
    }

    return res.json({
      ok: true,
      total: clientes.length,
      omitidos: omitidos.length,
      codigo_cuenta: config.codigoCuenta
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/migrar/bodegas", async (_req, res) => {
  try {
    if (!fs.existsSync(config.bodegasExcel)) {
      return res.status(400).json({
        ok: false,
        error: "No está el Excel en datos/bodegas.xlsx"
      });
    }

    const { bodegas, omitidos } = leerBodegas(
      config.bodegasExcel,
      config.codigoCuenta
    );

    for (let i = 0; i < bodegas.length; i += LOTE) {
      await supabase.upsert(
        config,
        "bodega",
        bodegas.slice(i, i + LOTE),
        "codigo_cuenta,codigo"
      );
    }

    return res.json({
      ok: true,
      total: bodegas.length,
      omitidos: omitidos.length,
      codigo_cuenta: config.codigoCuenta
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/migrar/facturas", async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  let migrarFacturas;
  try {
    ({ migrarFacturas } = require("./lib/migrar-facturas"));
  } catch (_) {
    return res.status(503).json({ ok: false, error: "Módulo de migración no disponible en este entorno." });
  }

  try {
    const resultado = await migrarFacturas(config, function (msg) {
      console.log(msg);
    });
    return res.json(Object.assign({ ok: true }, resultado));
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/migrar/compras", async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  let migrarCompras;
  try {
    ({ migrarCompras } = require("./lib/migrar-compras"));
  } catch (_) {
    return res.status(503).json({ ok: false, error: "Módulo de migración no disponible en este entorno." });
  }

  try {
    const resultado = await migrarCompras(config, function (msg) {
      console.log(msg);
    });
    return res.json(Object.assign({ ok: true }, resultado));
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/tablero/inventario", async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  const body = req.body || {};
  let fechaInicio = body.fecha_inicio;
  let fechaFin = body.fecha_fin;

  if (!fechaInicio || !fechaFin) {
    const parsed = fechasDesdeQuery(body.query || "");
    if (parsed) {
      fechaInicio = parsed.fechaInicio;
      fechaFin = parsed.fechaFin;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio || "") || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin || "")) {
    return res.status(400).json({
      success: false,
      error: "Indica fecha_inicio y fecha_fin (YYYY-MM-DD)"
    });
  }

  try {
    const rows = await consultarTableroRapido(config, fechaInicio, fechaFin);
    return res.json({
      success: true,
      rows
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.use("/api", (_req, res) => {
  res.status(404).json({
    ok: false,
    error: "Ruta de API no encontrada. Reinicia el servidor con npm start."
  });
});

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log("Servidor en http://localhost:" + config.port);
    console.log("Migración: http://localhost:" + config.port + "/migracion.html");
  });
}

module.exports = app;
