-- SQL Editor → Run todo de una vez (actualiza columnas + función).

ALTER TABLE emp_jbr_cygnus_y9ihz.orden_compra_linea
  ADD COLUMN IF NOT EXISTS importe_total numeric;

ALTER TABLE emp_jbr_cygnus_y9ihz.orden_venta_linea
  ADD COLUMN IF NOT EXISTS importe_total numeric;

ALTER TABLE emp_jbr_cygnus_y9ihz.orden_compra_linea
  ADD COLUMN IF NOT EXISTS fecha_movimiento date;

CREATE OR REPLACE FUNCTION emp_jbr_cygnus_y9ihz.get_ventas_compras_inventario(
    p_fecha_inicio date,
    p_fecha_fin date
)
RETURNS TABLE (
    "IdProducto" uuid,
    "CodigoProducto" character varying,
    "NombreProducto" character varying,
    "Unidad" character varying,
    "CantidadCompra" numeric,
    "CantidadVenta" numeric,
    "CantidadMerma" numeric,
    "ExistenciaActual" numeric,
    "CostoTotalCompra" numeric,
    "VentaTotal" numeric,
    "CostoTotalMerma" numeric,
    "ValorInventario" numeric,
    "CostoUnitario" numeric,
    "VentaUnitaria" numeric,
    "MermaDesecho" numeric
)
LANGUAGE sql
STABLE
AS $$
    WITH compra AS (
        SELECT
            l.id_producto,
            SUM(l.cantidad) AS cantidad_compra,
            SUM(COALESCE(l.importe_total, l.cantidad * l.precio_unitario)) AS costo_total_compra
        FROM emp_jbr_cygnus_y9ihz.orden_compra oc
        INNER JOIN emp_jbr_cygnus_y9ihz.orden_compra_linea l
            ON l.id_orden_compra = oc.id_orden_compra
        WHERE oc.codigo_cuenta = '023WA'
          AND COALESCE(l.fecha_movimiento, oc.fecha_emision) BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY l.id_producto
    ),
    venta AS (
        SELECT
            l.id_producto,
            SUM(l.cantidad_despachada) AS cantidad_venta,
            SUM(COALESCE(l.importe_total, l.cantidad_despachada * l.precio_unitario)) AS venta_total
        FROM emp_jbr_cygnus_y9ihz.orden_venta ov
        INNER JOIN emp_jbr_cygnus_y9ihz.orden_venta_linea l
            ON l.id_orden_venta = ov.id_orden_venta
        WHERE ov.codigo_cuenta = '023WA'
          AND ov.fecha_pedido BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY l.id_producto
    ),
    merma AS (
        SELECT
            mi.id_producto,
            SUM(mi.cantidad) AS cantidad_merma,
            SUM(mi.cantidad * COALESCE(mi.costo_unitario, 0)) AS costo_total_merma
        FROM emp_jbr_cygnus_y9ihz.movimiento_inventario mi
        WHERE mi.codigo_cuenta = '023WA'
          AND mi.tipo_movimiento = 'merma'
          AND mi.created_at::date BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY mi.id_producto
    ),
    inventario AS (
        SELECT
            ws.id_producto,
            SUM(ws.cantidad) AS existencia_actual,
            SUM(COALESCE(lt.costo_unitario, 0)) AS valor_inventario
        FROM emp_jbr_cygnus_y9ihz.warehouse_state ws
        INNER JOIN emp_jbr_cygnus_y9ihz.bodega b
            ON b.id_bodega = ws.id_bodega
        LEFT JOIN emp_jbr_cygnus_y9ihz.lote lt
            ON lt.id_lote = ws.id_lote
        WHERE ws.codigo_cuenta = '023WA'
          AND b.codigo = '8'
        GROUP BY ws.id_producto
        HAVING SUM(ws.cantidad) <> 0
    ),
    ids AS (
        SELECT id_producto FROM compra
        UNION
        SELECT id_producto FROM venta
        UNION
        SELECT id_producto FROM merma
        UNION
        SELECT id_producto FROM inventario
    )
    SELECT
        p.id_producto,
        p.sku,
        p.descripcion,
        p.unidad_medida,
        COALESCE(c.cantidad_compra, 0),
        COALESCE(v.cantidad_venta, 0),
        COALESCE(m.cantidad_merma, 0),
        COALESCE(i.existencia_actual, 0),
        COALESCE(c.costo_total_compra, 0),
        COALESCE(v.venta_total, 0),
        COALESCE(m.costo_total_merma, 0),
        COALESCE(i.valor_inventario, 0),
        COALESCE(c.costo_total_compra, 0) / NULLIF(COALESCE(c.cantidad_compra, 0), 0),
        COALESCE(v.venta_total, 0) / NULLIF(COALESCE(v.cantidad_venta, 0), 0),
        COALESCE(m.cantidad_merma, 0) / NULLIF(COALESCE(c.cantidad_compra, 0), 0)
    FROM ids
    INNER JOIN emp_jbr_cygnus_y9ihz.producto p
        ON p.id_producto = ids.id_producto
    LEFT JOIN compra c ON c.id_producto = ids.id_producto
    LEFT JOIN venta v ON v.id_producto = ids.id_producto
    LEFT JOIN merma m ON m.id_producto = ids.id_producto
    LEFT JOIN inventario i ON i.id_producto = ids.id_producto
    WHERE p.sku ~ '^[0-9]+$'
      AND p.sku::bigint < 601000024
    ORDER BY p.sku
$$;

NOTIFY pgrst, 'reload schema';
