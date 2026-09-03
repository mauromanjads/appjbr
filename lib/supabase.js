function headers(config, extra) {
  return Object.assign(
    {
      apikey: config.supabase.key,
      Authorization: "Bearer " + config.supabase.key,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Profile": config.supabase.schema,
      "Content-Profile": config.supabase.schema
    },
    extra || {}
  );
}

function baseUrl(config) {
  return config.supabase.url.replace(/\/+$/, "");
}

async function leerError(response) {
  try {
    const data = await response.json();
    return data.message || data.error_description || JSON.stringify(data);
  } catch (_error) {
    return response.status + " " + response.statusText;
  }
}

async function upsert(config, tabla, filas, onConflict) {
  const url =
    baseUrl(config) +
    "/rest/v1/" +
    encodeURIComponent(tabla) +
    "?on_conflict=" +
    encodeURIComponent(onConflict);

  const response = await fetch(url, {
    method: "POST",
    headers: headers(config, {
      Prefer: "resolution=merge-duplicates,return=minimal"
    }),
    body: JSON.stringify(filas)
  });

  if (!response.ok) {
    throw new Error(await leerError(response));
  }
}

async function seleccionar(config, tabla, query) {
  const page = 1000;
  let from = 0;
  const all = [];
  const qs = query ? "?" + query : "";

  while (true) {
    const response = await fetch(
      baseUrl(config) + "/rest/v1/" + encodeURIComponent(tabla) + qs,
      {
        headers: headers(config, {
          Prefer: "count=exact",
          Range: from + "-" + (from + page - 1),
          "Range-Unit": "items"
        })
      }
    );

    if (!response.ok) {
      throw new Error(await leerError(response));
    }

    const chunk = await response.json();
    all.push.apply(all, chunk);
    if (chunk.length < page) {
      break;
    }
    from += page;
  }

  return all;
}

module.exports = {
  headers,
  baseUrl,
  leerError,
  upsert,
  seleccionar
};
