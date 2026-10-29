/**
 * Test Suite: Voice Command Matcher
 * Verifies exact matching, regex argument extraction, Levenshtein distance fuzzy matching,
 * and wake word filtering.
 */

import { voiceCommandSystem, computeLevenshtein, computeSimilarity } from '../src/services/voiceCommands';

export function runCommandMatcherTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('--- Testing Command Matcher & Levenshtein Distance ---');

  // 1. Levenshtein Distance
  assert(computeLevenshtein('kitten', 'sitting') === 3, 'Levenshtein kitten -> sitting should be 3');
  assert(computeLevenshtein('describe', 'describe') === 0, 'Exact string distance should be 0');
  assert(computeSimilarity('describe', 'discribe') > 0.8, 'Single-char typo similarity should be > 0.8');

  // 2. Exact Commands
  voiceCommandSystem.setWakeWordRequirement(false);

  const m1 = voiceCommandSystem.evaluateUtterance('describe');
  assert(m1 !== null && m1.commandId === 'describe_scene', 'Matches "describe" -> describe_scene');

  const m2 = voiceCommandSystem.evaluateUtterance("what's around me");
  assert(m2 !== null && m2.commandId === 'describe_scene', 'Matches "what\'s around me" -> describe_scene');

  const m3 = voiceCommandSystem.evaluateUtterance('read this');
  assert(m3 !== null && m3.commandId === 'read_text', 'Matches "read this" -> read_text');

  const m4 = voiceCommandSystem.evaluateUtterance('emergency');
  assert(m4 !== null && m4.commandId === 'emergency', 'Matches "emergency" -> emergency');

  // 3. Argument Extraction
  const mSign = voiceCommandSystem.evaluateUtterance('sign water');
  assert(mSign !== null && mSign.commandId === 'sign_word' && mSign.args?.word === 'water', 'Extracts word "water" from "sign water"');

  const mSpell = voiceCommandSystem.evaluateUtterance('fingerspell hospital');
  assert(mSpell !== null && mSpell.commandId === 'fingerspell_word' && mSpell.args?.word === 'hospital', 'Extracts word "hospital" from "fingerspell hospital"');

  const mNav = voiceCommandSystem.evaluateUtterance('go to blind');
  assert(mNav !== null && mNav.commandId === 'navigate_page' && mNav.args?.target === 'blind', 'Extracts target "blind" from "go to blind"');

  // 4. Fuzzy Matching with Typos
  const mFuzzy = voiceCommandSystem.evaluateUtterance('discribe');
  assert(mFuzzy !== null && mFuzzy.commandId === 'describe_scene', 'Fuzzy matches "discribe" with typo to describe_scene');

  // 5. Wake Word Filtering
  voiceCommandSystem.setWakeWordRequirement(true);
  const mNoWake = voiceCommandSystem.evaluateUtterance('describe');
  assert(mNoWake === null, 'Rejects command when wake word is required but absent');

  const mWithWake = voiceCommandSystem.evaluateUtterance('bridge describe');
  assert(mWithWake !== null && mWithWake.commandId === 'describe_scene', 'Accepts command when wake word "bridge" is present');

  voiceCommandSystem.setWakeWordRequirement(false);

  console.log(`  Command Matcher: ${passed} passed, ${failed} failed`);
  return { passed, failed, errors };
}
