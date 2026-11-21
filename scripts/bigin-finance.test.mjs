import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateBiginFinance, normalizeBiginFinanceProduct } from '../api/_lib/bigin-finance.js'
test('Bigin finance reconciles linked products, refunds, estimated costs and saved ads', () => {
  const paid=[{id:'1',stage:'PAID',paidDate:'2026-11-16',amount:100},{id:'1',stage:'PAID',paidDate:'2026-11-16',amount:100},{id:'2',stage:'PAID',paidDate:'2026-11-16',amount:50},{id:'3',stage:'LOST',paidDate:'2026-11-16',amount:999}]
  const refunds=[{id:'4',stage:'Refund',paidDate:'2026-11-16',amount:20}]
  const items=[{dealId:'1',source:'Linked product',name:'Compounded Semaglutide 1mg',itemAmount:80,quantity:2},{dealId:'2',source:'Product field only',name:'Unknown',itemAmount:null,quantity:null}]
  const r=aggregateBiginFinance(paid,refunds,items,'2026-11-16',{meta:5,tiktok:3})
  assert.equal(r.dealCount,2)
  assert.equal(r.totalRevenue,130)
  assert.equal(r.revenueLoss.refund,-20)
  assert.equal(r.cogs,48)
  assert.equal(r.reconciliationDifference,70)
  assert.equal(r.rows[0].product,'Semaglutide')
  assert.equal(r.rows[0].quantity,2)
  assert.equal(r.rows.reduce((sum,row)=>sum+row.revenue,0)+r.revenueLoss.refund,r.totalRevenue)
  assert.equal(r.adsCostMeta+r.adsCostTiktok,8)
})
test('product categories match finance rules and zero refund amounts remain zero', () => {
  assert.equal(normalizeBiginFinanceProduct('Subscription Semaglutide').category,'Subscription')
  assert.equal(normalizeBiginFinanceProduct('Personalized Nutrition Consultation').product,'Nutritional Consultation')
  assert.equal(normalizeBiginFinanceProduct('Daily Vitamins').category,'Supplements')
  const r=aggregateBiginFinance([],[{id:'1',stage:'Refund',paidDate:'2026-11-16',amount:0}],[],'2026-11-16')
  assert.equal(r.totalRevenue,0)
  assert.equal(r.refundCount,1)
})
