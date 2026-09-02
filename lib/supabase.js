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

module.exports = {
  headers,
  baseUrl,
  leerError,
  upsert
};
