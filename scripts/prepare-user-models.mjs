/** Offline preparation of the supplied, unrigged Meshy avatars. No network access.
 * CLI: node scripts/prepare-user-models.mjs [input] [output] [catalog.json]
 * Inspect front/back without glTF-Transform: ... --inspect input output
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createCanvas, loadImage, ImageData } from '@napi-rs/canvas';
import {SOCK_TOP,SOCK_HALF_WIDTH,sockColorFor,thumbnailName,sockShapeParts} from '../public/footwear.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {findBodyContacts} from '../public/avatar-kinematics.js';

const HEIGHT = 1.8;
// These ten supplied models face +Z. Rotate 180 degrees around Y for the
// application's -Z-forward rig. Never infer a different orientation per LOD.
const SOURCE_FRONT = '+Z';
const QA_SIZE = 320;
const BUDGETS = { full: { triangles: Infinity, texture: 1024 }, near: { triangles: 2500, texture: 512 }, far: { triangles: 1800, texture: 512 } };

function boundsOf(p) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i++) { const a = i % 3; min[a] = Math.min(min[a], p[i]); max[a] = Math.max(max[a], p[i]); }
  return { min, max };
}
function normalization(p) {
  const b = boundsOf(p), scale = HEIGHT / (b.max[1] - b.min[1]);
  return { sourceFront: SOURCE_FRONT, targetFront: '-Z', rotationY: Math.PI, scale, sourceBounds: b,
    centerX: (b.min[0] + b.max[0]) / 2, centerZ: (b.min[2] + b.max[2]) / 2, feetY: b.min[1] };
}
function normalize(p, n, t) {
  for (let i = 0; i < p.length; i += 3) {
    p[i] = -(p[i] - t.centerX) * t.scale;
    p[i + 1] = (p[i + 1] - t.feetY) * t.scale;
    p[i + 2] = -(p[i + 2] - t.centerZ) * t.scale;
    if (n) { n[i] = -n[i]; n[i + 2] = -n[i + 2]; }
  }
}

/** Small read-only GLB reader used for source validation and honest thumbnails. */
export function inspectGLB(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint32(0, true) !== 0x46546c67 || v.getUint32(4, true) !== 2) throw new Error('Expected glTF 2 GLB');
  let json, bin;
  for (let off = 12; off < bytes.byteLength;) {
    const size = v.getUint32(off, true), kind = v.getUint32(off + 4, true); off += 8;
    const chunk = bytes.subarray(off, off + size);
    if (kind === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
    if (kind === 0x004e4942) bin = chunk;
    off += size;
  }
  if (!json || !bin) throw new Error('GLB must have JSON and embedded BIN');
  function array(id) {
    const a = json.accessors[id], b = json.bufferViews[a.bufferView];
    const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const C = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
    if (!C || !widths[a.type] || a.sparse || a.normalized) throw new Error('Unsupported source accessor');
    const count = a.count * widths[a.type], start = (b.byteOffset || 0) + (a.byteOffset || 0), stride = b.byteStride || widths[a.type] * C.BYTES_PER_ELEMENT;
    const out = new C(count), d = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const read = { 5121: 'getUint8', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let c = 0; c < widths[a.type]; c++) out[i * widths[a.type] + c] = d[read](start + i * stride + c * C.BYTES_PER_ELEMENT, true);
    return out;
  }
  if (json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1 || json.skins?.length || json.animations?.length) throw new Error('Expected one unrigged source mesh');
  for (const node of json.nodes || []) {
    if (node.matrix || node.rotation || node.translation || node.scale) throw new Error('Source transforms must be identity; bake before preparation');
  }
  const primitive = json.meshes[0].primitives[0];
  if ((primitive.mode ?? 4) !== 4) throw new Error('Source must use triangle primitives');
  const image = json.images?.[json.textures?.[json.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorTexture?.index]?.source];
  const bv = image && json.bufferViews[image.bufferView];
  return { json, positions: array(primitive.attributes.POSITION), normals: array(primitive.attributes.NORMAL), uv: array(primitive.attributes.TEXCOORD_0), indices: array(primitive.indices), image: bv && bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength) };
}

/** Orthographic CPU rasterization of the actual textured triangles, not a replacement face or texture crop. */
export async function renderThumbnail(model, { back = false, size = 640, footwear = null } = {}) {
  const frameBounds=boundsOf(model.positions);let rendered=model,sockStart=Infinity;
  if(footwear){
    const body=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(model.positions,3)).setAttribute('normal',new THREE.BufferAttribute(model.normals,3)).setAttribute('uv',new THREE.BufferAttribute(model.uv,2)).setIndex(new THREE.BufferAttribute(model.indices,1));
    const parts=sockShapeParts(findBodyContacts(body).feet).map(({center,radii})=>{const g=new THREE.SphereGeometry(1,12,8);g.scale(...radii);g.translate(...center);return g;});
    sockStart=body.attributes.position.count;const geometry=mergeGeometries([body,...parts],false);
    rendered={...model,positions:geometry.attributes.position.array,normals:geometry.attributes.normal.array,uv:geometry.attributes.uv.array,indices:geometry.index.array};
    body.dispose();parts.forEach(g=>g.dispose());geometry.dispose();
  }
  const { positions: p, normals: n, uv, indices } = rendered;
  const texture = await loadImage(Buffer.from(model.image));
  const tc = createCanvas(texture.width, texture.height), tx = tc.getContext('2d'); tx.drawImage(texture, 0, 0);
  const tex = tx.getImageData(0, 0, texture.width, texture.height).data, tw = texture.width, th = texture.height;
  const sockRgb=footwear?[1,3,5].map(start=>parseInt(footwear.slice(start,start+2),16)):null;
  const b = frameBounds, scale = size * .86 / Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]);
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2;
  const pixel = new Uint8ClampedArray(size * size * 4), depth = new Float32Array(size * size).fill(Infinity);
  const projected = new Float32Array(p.length), sign = back ? 1 : -1;
  for (let i = 0; i < p.length; i += 3) { projected[i] = size / 2 + sign * (p[i] - cx) * scale; projected[i + 1] = size / 2 - (p[i + 1] - cy) * scale; projected[i + 2] = p[i + 2] * (back ? -1 : 1); }
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], c = indices[t + 1], d = indices[t + 2];
    const ax = projected[a * 3], ay = projected[a * 3 + 1], bx = projected[c * 3], by = projected[c * 3 + 1], cx2 = projected[d * 3], cy2 = projected[d * 3 + 1];
    const denom = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2); if (Math.abs(denom) < .00001) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx2))), x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx2)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy2))), y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy2)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const wa = ((by - cy2) * (x + .5 - cx2) + (cx2 - bx) * (y + .5 - cy2)) / denom;
      const wb = ((cy2 - ay) * (x + .5 - cx2) + (ax - cx2) * (y + .5 - cy2)) / denom, wc = 1 - wa - wb;
      if (wa < -.00001 || wb < -.00001 || wc < -.00001) continue;
      const z = projected[a * 3 + 2] * wa + projected[c * 3 + 2] * wb + projected[d * 3 + 2] * wc, idx = y * size + x;
      if (z >= depth[idx]) continue; depth[idx] = z;
      const u = uv[a * 2] * wa + uv[c * 2] * wb + uv[d * 2] * wc, v = uv[a * 2 + 1] * wa + uv[c * 2 + 1] * wb + uv[d * 2 + 1] * wc;
      const fx = Math.max(0, Math.min(tw - 1, u * (tw - 1))), fy = Math.max(0, Math.min(th - 1, v * (th - 1))), ix = Math.floor(fx), iy = Math.floor(fy), dx = fx - ix, dy = fy - iy;
      const nz = n[a * 3 + 2] * wa + n[c * 3 + 2] * wb + n[d * 3 + 2] * wc;
      const ny = n[a * 3 + 1] * wa + n[c * 3 + 1] * wb + n[d * 3 + 1] * wc;
      const lighting = .83 + .17 * Math.max(0, (back ? nz : -nz) * .8 + ny * .6);
      const restY=p[a*3+1]*wa+p[c*3+1]*wb+p[d*3+1]*wc,restX=p[a*3]*wa+p[c*3]*wb+p[d*3]*wc;
      const coveredFoot=sockRgb&&(a>=sockStart||restY<SOCK_TOP&&Math.abs(restX)<SOCK_HALF_WIDTH);
      for (let k = 0; k < 3; k++) {
        const sample = (sx, sy) => tex[(sy * tw + sx) * 4 + k];
        const top = sample(ix, iy) * (1 - dx) + sample(Math.min(tw - 1, ix + 1), iy) * dx;
        const bot = sample(ix, Math.min(th - 1, iy + 1)) * (1 - dx) + sample(Math.min(tw - 1, ix + 1), Math.min(th - 1, iy + 1)) * dx;
        pixel[idx * 4 + k] = (coveredFoot?sockRgb[k]:top * (1 - dy) + bot * dy) * lighting;
      }
      pixel[idx * 4 + 3] = 255;
    }
  }
  const canvas = createCanvas(size, size); canvas.getContext('2d').putImageData(new ImageData(pixel, size, size), 0, 0);
  return canvas.toBuffer('image/png');
}

async function resizeTextures(doc, maxSize) {
  const result = [];
  for (const texture of doc.getRoot().listTextures()) {
    const source = texture.getImage(); if (!source) throw new Error('All texture maps must be embedded');
    const image = await loadImage(Buffer.from(source)), ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * ratio)), height = Math.max(1, Math.round(image.height * ratio));
    const canvas = createCanvas(width, height), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, width, height);
    // Lossless PNG retains alpha and works with standard glTF loaders, including normal/ORM maps.
    texture.setImage(new Uint8Array(canvas.toBuffer('image/png'))).setMimeType('image/png').setURI('');
    result.push({ width, height });
  }
  return result;
}

function compactPrimitive(primitive, indices) {
  const used = new Map(), order = [];
  for (const vertex of indices) if (!used.has(vertex)) { used.set(vertex, order.length); order.push(vertex); }
  const compact = new (order.length <= 65535 ? Uint16Array : Uint32Array)(indices.length);
  for (let i = 0; i < indices.length; i++) compact[i] = used.get(indices[i]);
  for (const semantic of primitive.listSemantics()) {
    const accessor = primitive.getAttribute(semantic), original = accessor.getArray(), width = accessor.getElementSize(), reduced = new original.constructor(order.length * width);
    for (let i = 0; i < order.length; i++) for (let c = 0; c < width; c++) reduced[i * width + c] = original[order[i] * width + c];
    accessor.setArray(reduced);
  }
  primitive.getIndices().setArray(compact);
}

function reducePrimitive(primitive, target, simplifier) {
  const p = primitive.getAttribute('POSITION').getArray(), n = primitive.getAttribute('NORMAL').getArray(), uv = primitive.getAttribute('TEXCOORD_0').getArray();
  const indices = Uint32Array.from(primitive.getIndices().getArray());
  if (indices.length <= target * 3) return { error: 0, originalTriangles: indices.length / 3 };
  const attributes = new Float32Array(p.length / 3 * 5), locks = new Uint8Array(p.length / 3);
  for (let i = 0; i < p.length / 3; i++) attributes.set([n[i * 3], n[i * 3 + 1], n[i * 3 + 2], uv[i * 2], uv[i * 2 + 1]], i * 5);
  // Pin the six extrema so every LOD keeps the original height, width and depth.
  for (let axis = 0; axis < 3; axis++) for (const side of [-1, 1]) {
    let index = 0; for (let i = 1; i < p.length / 3; i++) if (p[i * 3 + axis] * side > p[index * 3 + axis] * side) index = i;
    // Source hands/soles often have a clipped extremal plane with UV splits.
    // Lock every vertex on that plane; locking one seam representative alone
    // can let the entire supporting triangle disappear at the far LOD.
    for (let i = 0; i < p.length / 3; i++) if (Math.abs(p[i * 3 + axis] - p[index * 3 + axis]) < 1e-7) locks[i] = 1;
  }
  // Preserve atlas seams: Permissive may meet a smaller triangle budget but
  // crosses disconnected UV islands, visibly streaking the supplied clothes.
  // Normals and UVs also contribute directly to the collapse cost.
  const [reduced, error] = simplifier.simplifyWithAttributes(indices, p, 3, attributes, 5, [.15, .15, .15, 4, 4], locks, target * 3, 100, ['LockBorder']);
  if (reduced.length > Math.max(target, 7000) * 3) throw new Error(`UV seam floor exceeds LOD limit: ${reduced.length / 3} triangles`);
  compactPrimitive(primitive, reduced);
  return { error, originalTriangles: indices.length / 3, targetTriangles: target, budgetReached: reduced.length <= target * 3 };
}

async function alphaMask(png) {
  const image = await loadImage(png), canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0); const rgba = ctx.getImageData(0, 0, image.width, image.height).data;
  return { mask: Uint8Array.from({ length: image.width * image.height }, (_, i) => rgba[i * 4 + 3] > 127 ? 1 : 0), rgba };
}
function missingInterior(original, candidate) {
  const source = original.mask, reduced = candidate.mask;
  let interior = 0, missing = 0, colorOutliers = 0;
  for (let y = 3; y < QA_SIZE - 3; y++) for (let x = 3; x < QA_SIZE - 3; x++) {
    const i = y * QA_SIZE + x;
    if (!source[i] || !source[i - 3] || !source[i + 3] || !source[i - QA_SIZE * 3] || !source[i + QA_SIZE * 3] || !source[i - QA_SIZE * 3 - 3] || !source[i + QA_SIZE * 3 + 3] || !source[i - QA_SIZE * 3 + 3] || !source[i + QA_SIZE * 3 - 3]) continue;
    interior++; if (!reduced[i]) missing++;
    let colorError = 0;
    for (let c = 0; c < 3; c++) colorError += Math.abs(original.rgba[i * 4 + c] - candidate.rgba[i * 4 + c]) / 765;
    if (colorError > .25) colorOutliers++;
  }
  return { missing, interior, ratio: missing / Math.max(1, interior), colorOutliers, colorOutlierRatio: colorOutliers / Math.max(1, interior) };
}

export async function prepareUserModels(inputDir, outputDir, catalog) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { MeshoptSimplifier } = await import('meshoptimizer');
  await MeshoptSimplifier.ready;
  if (!MeshoptSimplifier.supported || !MeshoptSimplifier.simplifyWithAttributes) throw new Error('meshoptimizer attribute-aware WASM simplifier required');
  const io = new NodeIO(), entries = Array.isArray(catalog) ? catalog : catalog.models;
  if (!entries?.length) throw new Error('Nonempty model catalog required');
  await mkdir(outputDir, { recursive: true });
  const manifest = { version: 1, units: 'meters', height: HEIGHT, forward: '-Z', sourceFront: SOURCE_FRONT, thumbnail: 'Actual supplied textured mesh, orthographic front render', models: [] };
  for (const entry of entries) {
    if (!/^[a-zA-Z0-9_-]+$/.test(entry.id) || path.basename(entry.file) !== entry.file) throw new Error('Unsafe catalog id or filename');
    const source = new Uint8Array(await readFile(path.join(inputDir, entry.file))), hash = createHash('sha256').update(source).digest('hex');
    if (entry.sha256 && hash !== entry.sha256) throw new Error(`Source checksum mismatch: ${entry.id}`);
    const original = inspectGLB(source), transform = normalization(original.positions);
    normalize(original.positions, original.normals, transform);
    const canonicalBounds = boundsOf(original.positions), item = { id: entry.id, gender: entry.gender, source: entry.file, sourceSha256: hash, height: HEIGHT, bounds: canonicalBounds, normalization: transform, thumbnail: thumbnailName(entry), footwear:entry.gender==='female'?'opaque socks':undefined, variants: {} };
    const thumbnail=await renderThumbnail(original,{footwear:entry.gender==='female'?sockColorFor(entry.id):null});
    await writeFile(path.join(outputDir, item.thumbnail),thumbnail);
    // Replace legacy image URLs too; new selection URLs also invalidate old browser caches.
    if(entry.gender==='female')await writeFile(path.join(outputDir, `${entry.id}.png`),thumbnail);
    const referenceMasks = [];
    for (const back of [false, true]) referenceMasks.push(await alphaMask(await renderThumbnail(original, { back, size: QA_SIZE }))); 
    for (const [lod, budget] of Object.entries(BUDGETS)) {
      let doc = await io.readBinary(source); const meshes = doc.getRoot().listMeshes();
      const primitive = meshes[0].listPrimitives()[0];
      normalize(primitive.getAttribute('POSITION').getArray(), primitive.getAttribute('NORMAL').getArray(), transform);
      // Reassign accessor arrays so writer bounds are explicitly invalidated.
      for (const semantic of ['POSITION', 'NORMAL']) { const a = primitive.getAttribute(semantic); a.setArray(a.getArray()); }
      const reduction = lod === 'full' ? { error: 0, originalTriangles: original.indices.length / 3 } : reducePrimitive(primitive, budget.triangles, MeshoptSimplifier);
      let textures = await resizeTextures(doc, budget.texture);
      const filename = `${entry.id}-${lod}.glb`; let bytes = await io.writeBinary(doc);
      let qualityFallback = false, coverage = [];
      const attemptedTriangles = primitive.getIndices().getCount() / 3;
      if (lod !== 'full') {
        const reducedModel = inspectGLB(bytes);
        for (const [index, back] of [false, true].entries()) coverage.push(missingInterior(referenceMasks[index], await alphaMask(await renderThumbnail(reducedModel, { back, size: QA_SIZE }))));
        // Meshy sources can have nearly coincident disconnected seams that open
        // during otherwise valid QEM collapse. Keep original triangles whenever
        // front/back coverage shows holes. Low textures still save bandwidth.
        qualityFallback = coverage.some(result => (result.missing > 3 && result.ratio > .0004) || result.colorOutlierRatio > .003);
        if (qualityFallback) {
          doc = await io.readBinary(source);
          const safe = doc.getRoot().listMeshes()[0].listPrimitives()[0];
          normalize(safe.getAttribute('POSITION').getArray(), safe.getAttribute('NORMAL').getArray(), transform);
          for (const semantic of ['POSITION', 'NORMAL']) { const a = safe.getAttribute(semantic); a.setArray(a.getArray()); }
          textures = await resizeTextures(doc, budget.texture); bytes = await io.writeBinary(doc);
        }
      }
      await writeFile(path.join(outputDir, filename), bytes);
      // Roundtrip validates embedded maps, accessors, and actual output topology.
      const check = inspectGLB(bytes), bounds = boundsOf(check.positions);
      for (let axis = 0; axis < 3; axis++) for (const side of ['min', 'max']) if (Math.abs(bounds[side][axis] - canonicalBounds[side][axis]) > .00001) throw new Error(`LOD bounds changed: ${entry.id}/${lod}`);
      item.variants[lod] = { file: filename, bytes: bytes.length, triangles: check.indices.length / 3, vertices: check.positions.length / 3, drawCalls: 1, textures, bounds, simplificationError: reduction.error, targetTriangles: Number.isFinite(budget.triangles) ? budget.triangles : check.indices.length / 3, budgetReached: check.indices.length / 3 <= budget.triangles, qualityFallback, attemptedTriangles, coverage };
      console.log(`${entry.id} ${lod}: ${check.indices.length / 3} triangles, ${(bytes.length / 1024).toFixed(0)} KiB${qualityFallback ? ' (original topology retained: appearance QA)' : ''}`);
    }
    manifest.models.push(item);
    // A completed partial manifest survives interrupted authoring runs.
    await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--inspect') {
      const input = path.resolve(args[1] || 'work/user-models'), output = path.resolve(args[2] || 'work/user-model-inspection');
      const catalog = JSON.parse(await readFile(new URL('./user-model-sources.json', import.meta.url), 'utf8'));
      await mkdir(output, { recursive: true });
      for (const entry of catalog.models) {
        const model = inspectGLB(new Uint8Array(await readFile(path.join(input, entry.file)))), t = normalization(model.positions);
        normalize(model.positions, model.normals, t);
        const footwear=entry.gender==='female'?sockColorFor(entry.id):null;
        await writeFile(path.join(output, `${entry.id}-front.png`), await renderThumbnail(model,{footwear}));
        await writeFile(path.join(output, `${entry.id}-back.png`), await renderThumbnail(model, { back: true,footwear }));
        console.log(entry.id, model.indices.length / 3, 'triangles', JSON.stringify(t));
      }
    } else {
      const input = path.resolve(args[0] || 'work/user-models'), output = path.resolve(args[1] || 'public/user-models');
      const catalog = JSON.parse(await readFile(path.resolve(args[2] || 'scripts/user-model-sources.json'), 'utf8'));
      await prepareUserModels(input, output, catalog);
    }
  } catch (error) { console.error(error); process.exitCode = 1; }
}
