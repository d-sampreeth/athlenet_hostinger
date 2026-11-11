import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePhone, validExperience } from '../src/utils.js';

test('normalizes and validates Indian mobile numbers', () => {
  assert.equal(normalizePhone('9876543210'), '9876543210');
  assert.equal(normalizePhone('+91 8765432109'), '8765432109');
  assert.equal(normalizePhone('7654321098'), '7654321098');
  assert.equal(normalizePhone('6123456789'), '6123456789');
});

test('rejects invalid prefixes, lengths, and digits repeated more than six times', () => {
  for (const phone of [
    '5876543210',
    '1234567890',
    '987654321',
    '98765432100',
    '6666666123',
    '9999999123',
  ]) {
    assert.equal(normalizePhone(phone), '', phone);
  }
});

test('accepts only non-negative whole-number experience values within the database range', () => {
  for (const experience of ['0', '2', 2147483647, '', undefined]) {
    assert.equal(validExperience(experience), true, String(experience));
  }
  for (const experience of ['-1', '1.5', '2e3', '2147483648']) {
    assert.equal(validExperience(experience), false, experience);
  }
});
