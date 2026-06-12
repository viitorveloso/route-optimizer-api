import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine } from '../src/core/haversine.js';

const saoLuis = { lat: -2.5297, lng: -44.3028 };
const brasilia = { lat: -15.7939, lng: -47.8828 };

test('distance from a point to itself is zero', () => {
  assert.equal(haversine(saoLuis, saoLuis), 0);
});

test('distance is symmetric: d(a,b) === d(b,a)', () => {
  assert.equal(haversine(saoLuis, brasilia), haversine(brasilia, saoLuis));
});

test('São Luís -> Brasília is ~1525 km in a straight line', () => {
  const distance = haversine(saoLuis, brasilia);
  // Known great-circle distance; 1% tolerance for the spherical model.
  assert.ok(distance > 1510 && distance < 1545, `got ${distance} km`);
});

test('one degree of latitude is ~111 km', () => {
  const distance = haversine({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
  assert.ok(Math.abs(distance - 111.19) < 0.5, `got ${distance} km`);
});

test('handles antimeridian coordinates without blowing up', () => {
  const distance = haversine({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
  // 0.2 degrees of longitude at the equator ~ 22.2 km, not ~40,000 km.
  assert.ok(distance < 25, `got ${distance} km`);
});
