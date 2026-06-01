/**
 * Download em stream + parse incremental com stream-json.
 * Suporta arrays na raiz e arrays aninhados num objecto.
 */
import fs   from 'fs';
import os   from 'os';
import path from 'path';
import { pipeline as streamPipeline } from 'stream/promises';

import streamChain from 'stream-chain';
import streamJson  from 'stream-json';
import StreamArray from 'stream-json/streamers/StreamArray.js';
import Pick        from 'stream-json/filters/Pick.js';

const { chain }       = streamChain;
const { parser }      = streamJson;
const { streamArray } = StreamArray;
const { pick }        = Pick;

const MAX_RETRIES  = 3;
const RETRY_DELAY  = 4000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Descarrega o JSON para disco via stream.
 * Devolve o caminho do ficheiro temporário.
 */
export async function downloadToTemp(url) {
  const tmpPath = path.join(os.tmpdir(), `ar-sync-${Date.now()}.json`);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`  → Download (tentativa ${attempt}/${MAX_RETRIES})`);
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

      const file = fs.createWriteStream(tmpPath);
      await streamPipeline(res.body, file);

      const { size } = fs.statSync(tmpPath);
      console.log(`  → Concluído (${(size / 1_048_576).toFixed(1)} MB)`);
      return tmpPath;
    } catch (err) {
      console.warn(`  ⚠ Tentativa ${attempt} falhou: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY * attempt);
      else throw err;
    }
  }
}

/**
 * Itera os registos do JSON em stream.
 * nestedKey: se definido, faz pick dessa chave antes de iterar o array.
 *            se null/undefined, assume que o JSON raiz é um array.
 */
export async function* streamRecords(filepath, nestedKey) {
  const stages = nestedKey
    ? [
        fs.createReadStream(filepath),
        parser(),
        pick({ filter: nestedKey }),
        streamArray(),
      ]
    : [
        fs.createReadStream(filepath),
        parser(),
        streamArray(),
      ];

  console.log(nestedKey
    ? `  → A fazer stream do array "${nestedKey}"`
    : '  → A fazer stream do array raiz'
  );

  const pipe = chain(stages);
  for await (const { value } of pipe) {
    yield value;
  }
}
