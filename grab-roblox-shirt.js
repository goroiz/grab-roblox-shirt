#!/usr/bin/env node
// Roblox Classic Shirt Template Grabber
// by ijam x ChatGPT – ambil PNG template dari asset Classic Shirt/T-Shirt/Pants.
//
// Cara pakai:
//   node grab-roblox-shirt.js <assetUrlOrId> [outputPath]
//
// Contoh:
//   node grab-roblox-shirt.js https://www.roblox.com/catalog/123456789/Cool-Shirt
//   node grab-roblox-shirt.js 123456789 ./output/myshirt.png

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log('Usage: node grab-roblox-shirt.js <assetUrlOrId> [outputPath]');
    process.exit(1);
  }

  // ambil angka ID dari URL / teks
  const assetIdMatch = (arg.match(/\d{5,}/) || [])[0];
  if (!assetIdMatch) {
    console.error('Gagal: assetId ga ketemu dari input. Kasih URL/ID yang bener ya.');
    process.exit(1);
  }
  const assetId = assetIdMatch;

  const outputArg = process.argv[3] || null;

  // siapin HTTP client
  const http = require('axios').create({
    headers: { 'User-Agent': 'Mozilla/5.0 (TemplateGrabber)' },
    maxRedirects: 5,
    responseType: 'arraybuffer',
    validateStatus: s => s >= 200 && s < 400
  });

  // helper save
  const saveFile = (buf, suggested) => {
    const outPath = outputArg || path.join('output', suggested);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(buf));
    console.log('✅ Saved:', outPath);
  };

  console.log('➡️  Fetch asset XML/PNG for', assetId, '...');
  const url1 = `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`;
  const res1 = await http.get(url1);
  const ct1 = (res1.headers['content-type'] || '').toLowerCase();

  // kasus 1: langsung image (T-Shirt kadang gini)
  if (ct1.includes('image')) {
    saveFile(res1.data, `${assetId}.png`);
    return;
  }

  // kasus 2: XML (classic shirt/pants), extract image asset id
  const text = Buffer.from(res1.data).toString('utf8');

  // cari id gambar dari berbagai kemungkinan pola
  const m =
    text.match(/rbxassetid:\/\/(\d{3,})/i) ||
    text.match(/<url>\s*(?:rbxassetid:\/\/)?(\d{3,})\s*<\/url>/i) ||
    text.match(/ShirtTemplate[^0-9]+(\d{3,})/i) ||
    text.match(/PantsTemplate[^0-9]+(\d{3,})/i);

  if (!m) {
    // simpen XML biar bisa dicek manual
    saveFile(Buffer.from(text, 'utf8'), `${assetId}.xml`);
    console.error('⚠️  Gagal nemu imageId di XML. XML sudah disimpan. Cek manual pakai search: rbxassetid://');
    process.exit(2);
  }

  const imageId = m[1];
  console.log('🔎 Found image asset id:', imageId, '→ downloading PNG...');

  const url2 = `https://assetdelivery.roblox.com/v1/asset/?id=${imageId}`;
  const res2 = await http.get(url2);
  const ct2 = (res2.headers['content-type'] || '').toLowerCase();

  if (!ct2.includes('image')) {
    // fallback: tetap simpan apapun hasilnya
    saveFile(res2.data, `${assetId}.bin`);
    console.error('⚠️  Hasil bukan image. Disimpan sebagai .bin (cek manual).');
    process.exit(3);
  }

  // simpan PNG
  saveFile(res2.data, `${assetId}.png`);
}

main().catch(err => {
  console.error('❌ Error:', err && err.message ? err.message : err);
  process.exit(1);
});
