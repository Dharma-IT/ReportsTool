import test from 'node:test'
import assert from 'node:assert/strict'
import { getBiginTransactions, validateTransactionQuery, mapBiginItems } from '../api/_lib/bigin-transactions.js'
const query = overrides => new URLSearchParams({ from: '2026-11-01', to: '2026-11-21', pipeline: 'New Leads', ...overrides })
test('validates dates, pipeline allowlist, and search page limit', () => {
  for (const overrides of [{from:'2026-02-30'},{from:'2026-11-22'},{pipeline:'Other'},{page:'11'},{page:'1.5'}]) assert.throws(() => validateTransactionQuery(query(overrides)))
  assert.equal(validateTransactionQuery(query({})).page, 1)
})
test('keeps only PAID deals in range and enriches associated contacts without exposing OAuth tokens', async () => {
  const original = globalThis.fetch
  const env = {BIGIN_API_DOMAIN:'https://www.zohoapis.com',BIGIN_CLIENT_ID:'test',BIGIN_CLIENT_SECRET:'secret',BIGIN_REFRESH_TOKEN:'refresh'}
  globalThis.fetch = async url => {
    if (String(url).includes('/oauth/')) return Response.json({access_token:'private-token',expires_in:3600})
    if (String(url).includes('/Contacts?')) return Response.json({data:[{id:'contact',Full_Name:'Test Contact',Phone:'123',Email:'test@example.com'}]})
    assert.equal(new URL(url).searchParams.get('criteria'), '(((Pipeline:equals:New Leads)and(Stage:equals:PAID))and(Paid_Date:between:2026-11-01,2026-11-21))')
    return Response.json({data:[{id:'1',Stage:'PAID',Paid_Date:'2026-11-01',Amount:100.25,Contact_Name:{id:'contact'}},{id:'2',Stage:'LOST',Paid_Date:'2026-11-01'},{id:'3',Stage:'PAID',Paid_Date:'2026-10-31'},{id:'4',Stage:'PAID',Paid_Date:null}],info:{more_records:false}})
  }
  try {
    const result = await getBiginTransactions(query({}), env)
    assert.equal(result.rows.length,1)
    assert.equal(result.rows[0].phone,'123')
    assert.equal(result.rows[0].amount,100.25)
    assert.equal(JSON.stringify(result).includes('private-token'),false)
    globalThis.fetch = async () => Response.json({data:[],info:{more_records:true}})
    await assert.rejects(getBiginTransactions(query({page:'10'}),env), /2,000-record/)
  } finally {globalThis.fetch = original}
})

test('maps product rows and discounts without inventing missing item details or splitting names', () => {
  const deal = {id:'1',Paid_Date:'2026-11-20',Amount:40,Installments:15,Associated_Products:[{id:'a',Product:{name:'Product A'},List_Price:20,Quantity:2,Discount:10,Total:36},{id:'b',Product:{name:'Product B'},List_Price:4,Quantity:1,Discount_Amount:0,Total:4}]}
  const items = mapBiginItems(deal,{First_Name:'Test',Last_Name:'Contact'})
  assert.equal(items.length,2)
  assert.equal(items[0].discount,4)
  assert.equal(items[0].installmentFee,15)
  assert.equal(items[0].firstName,'Test')
  assert.equal(items[1].amount,40)
  const fallback = mapBiginItems({id:'2',Product:'Vitamins, daily'})
  assert.equal(fallback.length,1)
  assert.equal(fallback[0].quantity,null)
  assert.equal(fallback[0].unitPrice,null)
  assert.equal(mapBiginItems({id:'3'}).length,0)
  assert.throws(()=>mapBiginItems({id:'4',$has_more:{Associated_Products:true}}),/incomplete/)
})
