import {chromium} from 'playwright'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true})
const items=[{id:'a',title:'First',completed:true},{id:'b',title:'Second',completed:false},{id:'c',title:'Third',completed:false}]
try {
 const page=await browser.newPage()
 await page.route('**/api/todo',async route=>{
  const request=route.request()
  if(request.method()==='PATCH') {
   const body=request.postDataJSON()
   const index=items.findIndex(item=>item.id===body.id)
   const [item]=items.splice(index,1)
   const target=items.findIndex(item=>item.id===body.targetId)
   items.splice(target+(body.after?1:0),0,item)
  }
  await route.fulfill({json:request.method()==='GET'?{items}:{item:null}})
 })
 await page.goto('http://127.0.0.1:5188/todo')
 await page.getByRole('button',{name:'Move Third up',exact:true}).click()
 await page.getByText('Checklist order saved for everyone.',{exact:true}).waitFor()
 assert.deepEqual(items.map(item=>item.id),['a','c','b'])
 await page.waitForFunction(()=>!document.querySelector('.todo-drag-handle')?.disabled)
 const source=page.getByRole('button',{name:'Drag First to reorder',exact:true})
 const target=page.getByRole('checkbox',{name:'Second',exact:true}).locator('xpath=ancestor::li')
 await source.dragTo(target,{targetPosition:{x:100,y:65}})
 await page.waitForFunction(()=>!document.querySelector('.todo-drag-handle')?.disabled)
 assert.deepEqual(items.map(item=>item.id),['c','b','a'])
 await page.reload()
 await page.getByRole('checkbox',{name:'First',exact:true}).waitFor()
 assert.equal(await page.getByRole('checkbox',{name:'First',exact:true}).isChecked(),true)
 assert.deepEqual(await page.locator('.todo-list label span').allTextContents(),['Third','Second','First'])
 console.log('Browser checks passed: arrow moves, drag to bottom, shared reload order, checked state retained.')
} finally {await browser.close()}
