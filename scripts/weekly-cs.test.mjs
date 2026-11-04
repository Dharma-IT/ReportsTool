import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateCsDeals } from '../api/_lib/weekly-cs.ts'
test('CS lists count classified unique deals, no-response variants, and sales once', () => {
 const deal=(id,classification,dealstage='pending',source='Repurchase List')=>({id,properties:{classification,dealstage,imported_source:source,hubspot_owner_id:'1'}})
 const rows=[deal('1',' '),deal('2','No Response'),deal('2','No Response'),deal('3','No Response Semaglutide'),deal('4','Pending Payment'),deal('5','Completed Purchase','paid'),deal('6','Considering Purchase','paid','Abandoned Cart'),deal('7','Completed Purchase','won'),deal('8','No Response','lost','Other')]
 const result=aggregateCsDeals(rows,new Map([['1','Aline Strelow']]),new Map([['paid','PAID'],['won','MEDICALLY APPROVED (WON)'],['pending','WAITING FOR PAYMENT']]))
 assert.equal(result.repurchaseList['Aline Strelow'],5)
 assert.equal(result.repurchaseNoAnswer['Aline Strelow'],2)
 assert.equal(result.abandonedCart['Aline Strelow'],1)
 assert.equal(result.details.repurchaseList['Aline Strelow'].sales,2)
 assert.equal(result.details.abandonedCart['Aline Strelow'].sales,1)
})
