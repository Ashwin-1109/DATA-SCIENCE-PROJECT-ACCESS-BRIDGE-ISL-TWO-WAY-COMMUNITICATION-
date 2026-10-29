/**
 * Test Suite: Environment Narrator & Cooldowns
 * Verifies spatial direction, approximate distance estimation, priority ranking,
 * cooldown enforcement, and safety standard compliance.
 */

import { EnvironmentNarrator, SpatialObstacle } from '../src/services/environmentNarrator';

export function runNarratorTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('--- Testing Environment Narrator & Spatial Safety ---');

  const narrator = new EnvironmentNarrator();

  // 1. Direction Classification
  assert(narrator.estimateDirection([0.1, 0.2, 0.2, 0.4]) === 'left', 'Bounding box on left (center 0.2) classifies as "left"');
  assert(narrator.estimateDirection([0.4, 0.2, 0.2, 0.4]) === 'ahead', 'Bounding box in center (center 0.5) classifies as "ahead"');
  assert(narrator.estimateDirection([0.7, 0.2, 0.2, 0.4]) === 'right', 'Bounding box on right (center 0.8) classifies as "right"');

  // 2. Distance Estimation
  const closeDist = narrator.estimateDistance([0.2, 0.1, 0.6, 0.7]);
  assert(closeDist.includes('1 meter'), 'Large bounding box estimates ~1 meter');

  const farDist = narrator.estimateDistance([0.2, 0.1, 0.1, 0.15]);
  assert(farDist.includes('4 or more meters'), 'Small bounding box estimates 4+ meters');

  // 3. Priority Ranking
  assert(narrator.classifyPriority('person') === 'urgent', 'Person classified as urgent');
  assert(narrator.classifyPriority('car') === 'urgent', 'Vehicle classified as urgent');
  assert(narrator.classifyPriority('door') === 'medium', 'Door classified as medium');
  assert(narrator.classifyPriority('chair') === 'normal', 'Furniture classified as normal');

  // 4. Safety Standard
  const emptyResult = narrator.generateNarrationText([]);
  assert(
    emptyResult.text === 'No obstacles detected in view.',
    'Empty scene says "No obstacles detected in view."'
  );
  assert(
    !emptyResult.text.toLowerCase().includes('path is clear'),
    'Safety rule: NEVER says "path is clear"'
  );

  // 5. Cooldown Enforcement
  const mockObstacle: SpatialObstacle = {
    id: 'person_ahead_4',
    label: 'person',
    priority: 'urgent',
    direction: 'ahead',
    roughDistance: 'about 2 meters (approx)',
    confidence: 0.95,
    bbox: [0.4, 0.2, 0.2, 0.5],
    timestamp: performance.now()
  };

  // First narration should announce
  const first = narrator.generateNarrationText([mockObstacle]);
  assert(first.shouldSpeak === true, 'First detection triggers spoken announcement');
  assert(first.text.includes('person ahead'), 'Narration text includes "person ahead"');

  // Immediate second call should be silenced by cooldown
  const second = narrator.generateNarrationText([mockObstacle]);
  assert(second.shouldSpeak === false, 'Immediate duplicate detection suppressed by cooldown');

  console.log(`  Environment Narrator: ${passed} passed, ${failed} failed`);
  return { passed, failed, errors };
}
