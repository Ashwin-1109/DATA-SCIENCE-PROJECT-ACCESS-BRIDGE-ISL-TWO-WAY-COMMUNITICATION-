import { generateFingerspellingClip, ALPHABET_HANDSHAPES } from '../src/motion/fingerspelling';
import { VRMHumanBoneName } from '@pixiv/three-vrm';

export function runAvatarMotionTests(): { passed: number; failed: number; errors: string[] } {
  console.log('--- Testing Avatar Motion & Fingerspelling Kinematics ---');
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  const assert = (condition: boolean, msg: string) => {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(msg);
      console.error(`  FAIL: ${msg}`);
    }
  };

  // 1. All 26 letters defined
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  assert(
    letters.every(l => !!ALPHABET_HANDSHAPES[l]),
    'All 26 ISL manual alphabet handshapes (A-Z) must be defined'
  );

  // 2. All handshapes contain valid non-NaN unit quaternions
  let allUnitQuats = true;
  for (const [letter, bones] of Object.entries(ALPHABET_HANDSHAPES)) {
    for (const [bone, quat] of Object.entries(bones)) {
      if (!Array.isArray(quat) || quat.length !== 4) {
        allUnitQuats = false;
        break;
      }
      const [x, y, z, w] = quat;
      if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(w)) {
        allUnitQuats = false;
        break;
      }
      const lenSq = x * x + y * y + z * z + w * w;
      if (Math.abs(lenSq - 1.0) > 0.05) {
        allUnitQuats = false;
        break;
      }
    }
  }
  assert(allUnitQuats, 'All handshapes must contain valid, non-NaN normalized quaternions');

  // 3. Base arm signing posture verifies right arm raised and left arm resting downward
  const aShape = ALPHABET_HANDSHAPES['A'];
  const rUpper = aShape['rightUpperArm'];
  const lUpper = aShape['leftUpperArm'];
  const rLower = aShape['rightLowerArm'];

  assert(
    rUpper && rUpper[2] < -0.1,
    'Right upper arm must be positioned in chest signing space (z < -0.1)'
  );
  assert(
    rLower && rLower[1] > 0.4,
    'Right forearm elbow must be flexed forward toward chest signing space (y > 0.4)'
  );
  assert(
    lUpper && lUpper[2] > 0.4,
    'Left upper arm must rest downwards along the body (z > 0.4)'
  );

  // 4. Fingerspelling clip generator produces continuous playable keyframes
  const clip = generateFingerspellingClip('ACCESS');
  assert(clip.keyframes.length >= 6, 'generateFingerspellingClip should generate at least 6 keyframes for 6 letters');
  assert(clip.durationSec > 1.5, 'Duration should reflect hold and transition timing');
  assert(clip.keyframes[0].rotations['rightUpperArm'] !== undefined, 'Keyframes must carry full arm signing rotations');

  // 5. Finger curling verification (curled fingers flex with z < -0.4)
  const aIndexProx = aShape['rightIndexProximal'];
  assert(
    aIndexProx && aIndexProx[2] < -0.4,
    'Curled index finger in fist shape "A" must flex into palm along -Z (z < -0.4)'
  );

  console.log(`  Avatar Motion: ${passed} passed, ${failed} failed`);
  return { passed, failed, errors };
}
