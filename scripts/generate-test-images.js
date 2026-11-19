import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = path.resolve('test-artifacts');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 1. SVG
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <circle cx="100" cy="100" r="80" fill="#e11d48"/>
  <text x="100" y="110" font-size="24" text-anchor="middle" fill="white">CUSTOM SVG</text>
</svg>`;
fs.writeFileSync(path.join(dir, 'test.svg'), svgContent, 'utf-8');

// Function to create minimal uncompressed PNG
function createPng(width, height, colorRgba, minBytes = 0) {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    let c = 0xffffffff;
    for (let i = 0; i < body.length; i++) {
      c ^= body[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
      }
    }
    crc.writeInt32BE(~c, 0);
    return Buffer.concat([len, typeBuf, data, crc]);
  }

  const ihdr = chunk('IHDR', ihdrData);

  // Raw pixel data: for each scanline, 1 filter byte (0) + width * 4 bytes RGBA
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // filter type 0
    for (let x = 0; x < width; x++) {
      const px = rowOffset + 1 + x * 4;
      rawData[px] = (colorRgba[0] + (x ^ y)) & 0xff;
      rawData[px + 1] = (colorRgba[1] + (x * 7)) & 0xff;
      rawData[px + 2] = (colorRgba[2] + (y * 13)) & 0xff;
      rawData[px + 3] = colorRgba[3];
    }
  }

  // Compress with level 1 (fast compression)
  const compressed = zlib.deflateSync(rawData, { level: 1 });
  const idat = chunk('IDAT', compressed);
  const iend = chunk('IEND', Buffer.alloc(0));

  let fullPng = Buffer.concat([header, ihdr, idat, iend]);

  if (minBytes > fullPng.length) {
    const padSize = minBytes - fullPng.length - 12;
    const padData = Buffer.concat([Buffer.from('Comment\0'), Buffer.alloc(padSize - 8, 65)]);
    const textChunk = chunk('tEXt', padData);
    fullPng = Buffer.concat([header, ihdr, textChunk, idat, iend]);
  }

  return fullPng;
}

// 2. Small PNG
const smallPng = createPng(100, 100, [0, 150, 255, 200]);
fs.writeFileSync(path.join(dir, 'test.png'), smallPng);

// 3. 6.2 MB PNG
const largePng = createPng(1800, 1800, [50, 180, 50, 255], 6.2 * 1024 * 1024);
fs.writeFileSync(path.join(dir, 'test-large-6mb.png'), largePng);

console.log('Test images generated successfully:');
console.log(' - test.svg:', fs.statSync(path.join(dir, 'test.svg')).size, 'bytes');
console.log(' - test.png:', fs.statSync(path.join(dir, 'test.png')).size, 'bytes');
console.log(' - test-large-6mb.png:', fs.statSync(path.join(dir, 'test-large-6mb.png')).size, 'bytes');
