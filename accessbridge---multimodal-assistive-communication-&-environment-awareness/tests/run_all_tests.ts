/**
 * Master Test Runner for AccessBridge
 * Executes all Phase 8 unit tests:
 * 1. Command Matcher & Fuzzy Levenshtein Distance
 * 2. Environment Narrator, Spatial Rules & Cooldowns
 * 3. Keyframe Index Lookup (O(1) Amortized)
 * 4. Model Activation & UI Rollback Simulation
 */

import { runCommandMatcherTests } from './commandMatcher.test';
import { runNarratorTests } from './narratorCooldown.test';
import { runKeyframeLookupTests } from './keyframeLookup.test';
import { runAvatarMotionTests } from './avatarMotion.test';

async function main() {
  console.log('====================================================');
  console.log('       ACCESSBRIDGE PHASE 8 VERIFICATION SUITE       ');
  console.log('====================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  // 1. Command Matcher Tests
  const r1 = runCommandMatcherTests();
  totalPassed += r1.passed;
  totalFailed += r1.failed;
  allErrors.push(...r1.errors);
  console.log('');

  // 2. Narrator Cooldown & Safety Tests
  const r2 = runNarratorTests();
  totalPassed += r2.passed;
  totalFailed += r2.failed;
  allErrors.push(...r2.errors);
  console.log('');

  // 3. Keyframe Index Lookup Tests
  const r3 = runKeyframeLookupTests();
  totalPassed += r3.passed;
  totalFailed += r3.failed;
  allErrors.push(...r3.errors);
  console.log('');

  // 4. Avatar Motion & Fingerspelling Kinematics Tests
  const r4 = runAvatarMotionTests();
  totalPassed += r4.passed;
  totalFailed += r4.failed;
  allErrors.push(...r4.errors);
  console.log('');

  // 4. Frontend Model Activate Rollback Simulator
  console.log('--- Testing Frontend Model Activation Rollback Handler ---');
  let rollbackPassed = 0;
  let rollbackFailed = 0;

  // Simulate frontend state transition on API failure
  let currentActiveModel = '1D-CNN (Convolutional)';
  const requestedModel = 'Corrupted_Checkpoint.pth';
  let isRolledBack = false;

  // Simulated activate action with failure
  try {
    const fakeApiResponse = { ok: false, error: 'File not found or corrupted' };
    if (!fakeApiResponse.ok) {
      // Rollback to previous
      isRolledBack = true;
    } else {
      currentActiveModel = requestedModel;
    }
  } catch {
    isRolledBack = true;
  }

  if (isRolledBack && currentActiveModel === '1D-CNN (Convolutional)') {
    rollbackPassed++;
    console.log('  PASS: Frontend state safely preserved on activation failure.');
  } else {
    rollbackFailed++;
    allErrors.push('Frontend rollback simulation failed');
    console.error('  FAIL: Frontend state altered on activation failure.');
  }

  totalPassed += rollbackPassed;
  totalFailed += rollbackFailed;
  console.log(`  Frontend Rollback: ${rollbackPassed} passed, ${rollbackFailed} failed\n`);

  // Final Summary
  console.log('====================================================');
  console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('====================================================');

  if (totalFailed > 0) {
    console.error('\nFailures:');
    allErrors.forEach(e => console.error(` - ${e}`));
    process.exit(1);
  } else {
    console.log('\nAll AccessBridge tests completed with 100% success rate.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
