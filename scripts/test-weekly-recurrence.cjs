// Exercise the actual portal helper without adding another test toolchain.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = fs.readFileSync(path.join(__dirname, '../portal/lib/weeklyRecurrence.ts'), 'utf8');
const compiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(compiled, { exports: exported, Date, Array, Number, Error });
const { weeklyRecurrenceStarts } = exported;

process.env.TZ = 'America/New_York';
const spring = weeklyRecurrenceStarts('2027-03-07T10:00', 3);
assert.equal(new Date(spring[0]).getHours(), 10);
assert.equal(new Date(spring[1]).getHours(), 10);
assert.equal(Date.parse(spring[1]) - Date.parse(spring[0]), 167 * 3600000);
const fall = weeklyRecurrenceStarts('2027-10-31T10:00', 3);
assert.equal(new Date(fall[1]).getHours(), 10);
assert.equal(Date.parse(fall[1]) - Date.parse(fall[0]), 169 * 3600000);
process.env.TZ = 'Asia/Kolkata';
const india = weeklyRecurrenceStarts('2027-03-07T10:00', 52);
assert.equal(india.length, 52);
assert.ok(india.every(start => new Date(start).getHours() === 10));
assert.equal(Date.parse(india[1]) - Date.parse(india[0]), 168 * 3600000);
for (const count of [0, 1, 53, 2.5, NaN]) {
  assert.throws(() => weeklyRecurrenceStarts('2027-03-07T10:00', count));
}
assert.throws(() => weeklyRecurrenceStarts('not a date', 2));
console.log('PASS: weekly recurrence keeps local wall time across DST, half-hour timezones and bounded date validation');
