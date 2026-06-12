import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOptimizePayload } from '../src/http/validate.js';

const limits = { maxStops: 5 };

const validStop = (id) => ({ id, lat: -2.53, lng: -44.3 });

test('accepts a minimal valid payload', () => {
  const { valid, errors } = validateOptimizePayload(
    { stops: [validStop('a'), validStop('b')] },
    limits
  );

  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('rejects non-object bodies', () => {
  for (const body of [null, [], 'text', 42]) {
    const { valid } = validateOptimizePayload(body, limits);
    assert.equal(valid, false, `should reject ${JSON.stringify(body)}`);
  }
});

test('rejects missing or empty stops', () => {
  assert.equal(validateOptimizePayload({}, limits).valid, false);
  assert.equal(validateOptimizePayload({ stops: [] }, limits).valid, false);
});

test('rejects more stops than the configured limit', () => {
  const stops = Array.from({ length: 6 }, (_, i) => validStop(`s${i}`));
  const { valid, errors } = validateOptimizePayload({ stops }, limits);

  assert.equal(valid, false);
  assert.ok(errors.some((message) => message.includes('limit of 5')));
});

test('rejects out-of-range coordinates', () => {
  const { valid, errors } = validateOptimizePayload(
    { stops: [validStop('a'), { id: 'b', lat: 91, lng: -200 }] },
    limits
  );

  assert.equal(valid, false);
  assert.ok(errors.some((message) => message.includes('stops[1].lat')));
  assert.ok(errors.some((message) => message.includes('stops[1].lng')));
});

test('rejects non-numeric coordinates (including NaN)', () => {
  const { valid } = validateOptimizePayload(
    { stops: [validStop('a'), { id: 'b', lat: 'abc', lng: NaN }] },
    limits
  );

  assert.equal(valid, false);
});

test('rejects duplicated ids', () => {
  const { valid, errors } = validateOptimizePayload(
    { stops: [validStop('x'), validStop('x')] },
    limits
  );

  assert.equal(valid, false);
  assert.ok(errors.some((message) => message.includes('duplicated')));
});

test('collects every error in a single pass', () => {
  const { errors } = validateOptimizePayload(
    { stops: [{ id: {}, lat: 'a', lng: 999 }] },
    limits
  );

  assert.ok(errors.length >= 3, `expected 3+ errors, got: ${errors.join('; ')}`);
});

test('validates options.roundTrip type when present', () => {
  const stops = [validStop('a'), validStop('b')];

  assert.equal(
    validateOptimizePayload({ stops, options: { roundTrip: 'yes' } }, limits).valid,
    false
  );
  assert.equal(
    validateOptimizePayload({ stops, options: { roundTrip: true } }, limits).valid,
    true
  );
});
