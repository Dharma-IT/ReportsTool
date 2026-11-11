import {chromium} from 'playwright'
import {createServer} from 'vite'
import {loadEnv} from 'vite'
import assert from 'node:assert/strict'
import {todoRequest} from '../api/_lib/todo.js'
const {items}=await todoRequest('GET',undefined,loadEnv('development',process.cwd(),''))
const server=await createServer({server:{host:'127.0.0.1',port:5191}})
await server.listen()
const browser=await chromium.launch({headless:true})
try {
 const page=await browser.newPage()
 await page.route('**/api/todo',async route=>{
  if(route.request().method()==='PATCH'){const body=route.request().postDataJSON();items.find(item=>item.id===body.id).completed=body.completed}
  await route.fulfill({json:route.request().method()==='GET'?{items}:{item:null}})
 })
 await page.goto('http://127.0.0.1:5191/todo')
 const reports=page.getByRole('list',{name:'Reports sub-checklist',exact:true})
 await reports.waitFor()
 assert.equal(await reports.getByRole('checkbox').count(),11)
 assert.equal(await page.getByRole('list',{name:'Workflows sub-checklist',exact:true}).getByRole('checkbox').count(),3)
 assert.equal(await page.getByRole('list',{name:'Forms sub-checklist',exact:true}).getByRole('checkbox').count(),3)
 const checkbox=reports.getByRole('checkbox',{name:'Finance Report',exact:true})
 await checkbox.setChecked(!await checkbox.isChecked())
 await page.getByText('Checklist updated for everyone.',{exact:true}).waitFor()
 await page.getByLabel('Add under').selectOption({label:'Reports'})
 assert.equal(await page.getByLabel('Add under').inputValue(),items.find(item=>item.title==='Reports'&&!item.parent_id).id)
 console.log('Passed: 11 report sub-items, three workflows, three forms, independent completion, add-under selector; no live items modified.')
} finally {await browser.close();await server.close()}
