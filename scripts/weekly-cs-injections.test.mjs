import test from 'node:test'
import assert from 'node:assert/strict'
import { csInjectionUnits } from '../api/_lib/weekly-summary.ts'
test('CS HubSpot injection quantities include Microdose/Lipo Mino and exclude refund deals', () => {
 assert.equal(csInjectionUnits('Compounded Tirzepatide 60mg',3,1000),3)
 assert.equal(csInjectionUnits('Tirzepatide - Microdose',1,1000),1)
 assert.equal(csInjectionUnits('Lipo Mino 3 Month',1,889),1)
 assert.equal(csInjectionUnits('Compounded Tirzepatide 60mg',1,-1498.07),0)
 assert.equal(csInjectionUnits('Compounded Tirzepatide 52mg',1,-1058.94),0)
 assert.equal(csInjectionUnits('Slim Boost',2,1000),0)
 assert.equal(csInjectionUnits('Compounded Tirzepatide 60mg',1,0),0)
})
