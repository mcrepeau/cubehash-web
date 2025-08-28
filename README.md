## Cubehash Web

This repo a simple static web page that uses the [cubehash](github.com/mcrepeau/cubehash) WASM implementation to hash data in the browser.
It pulls the WASM binaries from a Cloudflare R2 bucket and loads the SIMD binary if the browser supports it, otherwise it falls back on the scalar binaries.

### Usage

1. Set the revision and bit length (from 8 to 512 by increments of 8) for the hash
2. Click on the File or the String tab
3. Upload a file and click Hash or type a string to get the hash output