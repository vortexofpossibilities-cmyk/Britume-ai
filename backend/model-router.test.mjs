import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseModel } from './model-router.mjs';

const env = {
  AI_MODEL: 'gpt-6-luna',
  AI_MODEL_ECONOMY: 'gpt-6-luna',
  AI_MODEL_BALANCED: 'gpt-6.1-terra',
  AI_MODEL_COMPLEX: 'gpt-6.2-sol',
};

test('routes everyday chat to economy model', () => {
  assert.deepEqual(chooseModel('Hi, how are you?', env), { tier: 'economy', model: 'gpt-6-luna' });
});

test('routes detailed analysis to balanced model', () => {
  assert.deepEqual(chooseModel('Compare these options and explain in detail.', env), { tier: 'balanced', model: 'gpt-6.1-terra' });
});

test('routes complex backend implementation to complex model', () => {
  assert.deepEqual(chooseModel('Build and architect a secure backend API.', env), { tier: 'complex', model: 'gpt-6.2-sol' });
});

test('uses configured fallback when a tier is not configured', () => {
  assert.equal(chooseModel('Please explain this', { AI_MODEL: 'custom-model' }).model, 'custom-model');
});
