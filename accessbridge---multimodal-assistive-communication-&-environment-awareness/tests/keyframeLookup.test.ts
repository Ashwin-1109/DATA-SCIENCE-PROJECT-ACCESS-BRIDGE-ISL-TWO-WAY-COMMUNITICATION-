/**
 * Test Suite: Keyframe Index Lookup
 * Verifies high-speed amortized O(1) keyframe search, temporal boundary conditions,
 * and rewind/looping handling.
 */

import { findKeyframeIndex } from '../src/motion/playbackController';

export function runKeyframeLookupTests(): { passed: number; failed: number; errors: string[] } {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(msg);
      console.error(`  FAIL: ${msg}`);
    }
  }

  console.log('--- Testing Keyframe Index Lookup (O(1) Amortized) ---');

  // Simulated 30 FPS clip (10 keyframes, 0.0s to 0.3s)
  const keyframes = Array.from({ length: 10 }, (_, i) => ({
    timeSec: i * (1.0 / 30.0)
  }));

  // 1. Initial lookup at start (t = 0.0)
  let idx = findKeyframeIndex(keyframes, 0.0, 0);
  assert(idx === 0, 'At t=0.0s, keyframe index is 0');

  // 2. Sequential forward stepping (monotonic playback)
  idx = findKeyframeIndex(keyframes, 0.05, idx);
  assert(idx === 1, 'At t=0.05s, keyframe index moves to 1');

  idx = findKeyframeIndex(keyframes, 0.12, idx);
  assert(idx === 3, 'At t=0.12s, keyframe index tracks to 3');

  idx = findKeyframeIndex(keyframes, 0.25, idx);
  assert(idx === 7, 'At t=0.25s, keyframe index tracks to 7');

  // 3. Boundary Condition: Time past end of clip
  idx = findKeyframeIndex(keyframes, 1.5, idx);
  assert(idx === 8, 'Time past end clamps to valid interpolation span (n - 2 = 8)');

  // 4. Boundary Condition: Loop or Rewind
  idx = findKeyframeIndex(keyframes, 0.02, idx);
  assert(idx === 0, 'Rewinding time resets search to 0 and finds correct index 0');

  // 5. Empty or Single Keyframe edge cases
  assert(findKeyframeIndex([], 0.5, 0) === 0, 'Empty keyframe list returns 0 safely without crash');
  assert(findKeyframeIndex([{ timeSec: 0.0 }], 0.5, 0) === 0, 'Single keyframe returns 0 safely');

  console.log(`  Keyframe Lookup: ${passed} passed, ${failed} failed`);
  return { passed, failed, errors };
}
