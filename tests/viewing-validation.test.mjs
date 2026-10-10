import test from 'node:test'
import assert from 'node:assert/strict'
import { validateViewing } from '../src/components/contact/viewing-validation.ts'
const today='2026-10-09'
const valid={name:'Example Visitor',email:'visitor@example.com',phone:'',property:'woodland',date:'2026-10-10',message:''}
test('viewing validation requires name, valid email, known property and future preference',()=>{
 assert.deepEqual(validateViewing(valid,['woodland'],today),{})
 const errors=validateViewing({...valid,name:' ',email:'not-an-email',property:'unknown',date:'2026-10-08'},['woodland'],today)
 assert.deepEqual(Object.keys(errors),['name','email','property','date'])
 assert.ok(validateViewing({...valid,date:'2026-02-30'},['woodland'],today).date)
 assert.ok(validateViewing({...valid,date:''},['woodland'],today).date)
 assert.deepEqual(validateViewing({...valid,property:'general',date:today},[],today),{})
})
