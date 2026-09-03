const path = require("path");
const fs = require("fs");
const express = require("express");
const config = require("./config");
const supabase = require("./lib/supabase");
const { leerProductos } = require("./lib/productos");
const { leerClientes } = require("./lib/clientes");
const { leerBodegas } = require("./lib/bodegas");
const { migrarFacturas } = require("./lib/migrar-facturas");
const { migrarCompras } = require("./lib/migrar-compras");

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

  try {
    const resultado = await migrarFacturas(config, function (msg) {
      console.log(msg);
    });
    return res.json(Object.assign({ ok: true }, resultado));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/migrar/compras", async (req, res) => {
  req.setTimeout(0);
  res.setTimeout(0);

  try {
    const resultado = await migrarCompras(config, function (msg) {
      console.log(msg);
    });
    return res.json(Object.assign({ ok: true }, resultado));
  } catch (error) {
    return res.status(500).json({
      ok: false,
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
