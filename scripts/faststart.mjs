// Move an MP4's index (moov) in front of its media (mdat) so browsers can start
// playing before the whole file has arrived. Blender writes moov at the end.
//   node scripts/faststart.mjs in.mp4 [out.mp4]
import { readFileSync, writeFileSync } from 'node:fs';

const [, , input, output = input] = process.argv;
const buf = readFileSync(input);

function boxes(b, start, end) {
  const out = [];
  let p = start;
  while (p + 8 <= end) {
    let size = b.readUInt32BE(p);
    const type = b.toString('latin1', p + 4, p + 8);
    let header = 8;
    if (size === 1) {
      size = Number(b.readBigUInt64BE(p + 8));
      header = 16;
    } else if (size === 0) size = end - p;
    out.push({ type, start: p, size, header });
    p += size;
  }
  return out;
}

const top = boxes(buf, 0, buf.length);
const moov = top.find((b) => b.type === 'moov');
const mdat = top.find((b) => b.type === 'mdat');
if (!moov || !mdat) throw new Error('not an mp4 with moov and mdat');
if (moov.start < mdat.start) {
  console.log('already faststart:', input);
  process.exit(0);
}

const moovBuf = Buffer.from(buf.subarray(moov.start, moov.start + moov.size));
const shift = moov.size;
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta']);

(function patch(start, end) {
  for (const b of boxes(moovBuf, start, end)) {
    if (CONTAINERS.has(b.type)) patch(b.start + b.header, b.start + b.size);
    else if (b.type === 'stco' || b.type === 'co64') {
      const n = moovBuf.readUInt32BE(b.start + b.header + 4);
      let p = b.start + b.header + 8;
      for (let i = 0; i < n; i++) {
        if (b.type === 'stco') {
          moovBuf.writeUInt32BE(moovBuf.readUInt32BE(p) + shift, p);
          p += 4;
        } else {
          moovBuf.writeBigUInt64BE(moovBuf.readBigUInt64BE(p) + BigInt(shift), p);
          p += 8;
        }
      }
    }
  }
})(8, moovBuf.length);

const parts = [];
for (const b of top) {
  if (b.type === 'moov') continue;
  if (b === mdat) parts.push(moovBuf);
  parts.push(buf.subarray(b.start, b.start + b.size));
}
writeFileSync(output, Buffer.concat(parts));
console.log('faststart:', output);
