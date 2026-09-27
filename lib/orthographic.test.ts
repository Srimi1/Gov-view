import assert from "node:assert/strict";
import test from "node:test";
import { globeBounds, projectGlobe, unprojectGlobe, wrapLongitude } from "./orthographic.ts";

test("orthographic map hides far-side points and reverses visible coordinates", () => {
  const camera = { latitude: 18, longitude: 10, height: 12_000_000 };
  const near = projectGlobe(28, 77, camera);
  assert.equal(near.visible, true);
  const point = unprojectGlobe(near.x, near.y, camera)!;
  assert.ok(Math.abs(point.latitude - 28) < 1e-8);
  assert.ok(Math.abs(point.longitude - 77) < 1e-8);
  assert.equal(projectGlobe(18, -170, camera).visible, false);
  assert.equal(unprojectGlobe(1.01, 0, camera), null);
});

test("camera longitude wraps and close zoom bounds cross the antimeridian", () => {
  assert.equal(wrapLongitude(181), -179);
  const bounds = globeBounds({ latitude: 0, longitude: 179, height: 2_000_000 }, 600, 600, 250);
  assert.ok(bounds.west > bounds.east);
  assert.ok(bounds.south < 0 && bounds.north > 0);
  assert.deepEqual(globeBounds({ latitude: 80, longitude: 10, height: 2_000_000 }, 600, 600, 250),
    { west: -180, south: -90, east: 180, north: 90 });
});
