import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validImage } from '../server/validation.ts';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const url = (mime: string, data: Buffer) => `data:image/${mime};base64,${data.toString('base64')}`;

test('allows JPEG, PNG and WebP signatures', () => {
  assert.equal(validImage(url('jpeg', jpeg)), true);
  assert.equal(validImage(url('png', png)), true);
  assert.equal(validImage(url('webp', Buffer.from('RIFF0000WEBP'))), true);
});
test('rejects mismatched MIME type and file bytes', () => {
  assert.equal(validImage(url('png', jpeg)), false);
  assert.equal(validImage(url('jpeg', png)), false);
  assert.equal(validImage(url('webp', png)), false);
});
test('rejects remote URLs and SVG payloads', () => {
  assert.equal(validImage('https://example.com/image.jpg'), false);
  assert.equal(validImage('data:image/svg+xml;base64,PHN2Zz4='), false);
});
test('rejects oversized and invalid inputs', () => {
  assert.equal(validImage(null), false);
  assert.equal(validImage({ image: 'hello' }), false);
  assert.equal(validImage('data:image/jpeg;base64,@@@'), false);
  assert.equal(validImage('data:image/jpeg;base64,/9j/'), false);
  const huge = Buffer.alloc(1_000_001); jpeg.copy(huge);
  assert.equal(validImage(url('jpeg', huge)), false);
});
