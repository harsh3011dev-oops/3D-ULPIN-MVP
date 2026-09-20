const fs = require('fs');
const zlib = require('zlib');
const file = process.argv[3];
const mode = process.argv[2];
const entry = process.argv[4];
const buf = fs.readFileSync(file);
const names = [];
let p = 0;
while (p + 30 <= buf.length) {
  if (buf.readUInt32LE(p) !== 0x04034b50) { p++; continue; }
  const method = buf.readUInt16LE(p + 8);
  const csize = buf.readUInt32LE(p + 18);
  const nlen = buf.readUInt16LE(p + 26);
  const elen = buf.readUInt16LE(p + 28);
  const name = buf.toString('utf8', p + 30, p + 30 + nlen);
  names.push(name);
  if (mode === '-p' && name === entry) {
    const data = buf.subarray(p + 30 + nlen + elen, p + 30 + nlen + elen + csize);
    process.stdout.write(method === 0 ? data : zlib.inflateRawSync(data));
    process.exit(0);
  }
  p += 30 + nlen + elen + csize;
}
if (mode === '-Z1') process.stdout.write(names.join('\n'));
