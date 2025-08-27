// functions/cubehash-wasm/[version]/[impl]/[file].js
export async function onRequest(context) {
  const { env, params } = context;
  const { version, impl, file } = params;

  // Build R2 key (bucket path)
  const key = `cubehash-wasm/${version}/${impl}/${file}`;

  // Try to fetch from R2
  const object = await env.ch_bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  // Guess MIME type
  let contentType = "application/octet-stream";
  if (file.endsWith(".js")) {
    contentType = "application/javascript";
  } else if (file.endsWith(".wasm")) {
    contentType = "application/wasm";
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*", // or restrict to https://cubehash-web.pages.dev
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
