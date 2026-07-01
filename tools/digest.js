#!/usr/bin/env node
'use strict';
// CLI digest: npm run digest  — draft this week's summary on demand.
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { generateDigest } = require(path.join(ROOT, 'app/lib/digest'));
const schedule = require(path.join(ROOT, 'app/lib/schedule'));
const { localDateString } = require(path.join(ROOT, 'app/lib/progress'));

const today = localDateString();
const weekly = schedule.ensureWeekly(today);
const file = generateDigest(schedule.mondayOf(today), weekly);
console.log(`digest drafted: ${path.relative(ROOT, file)}`);
