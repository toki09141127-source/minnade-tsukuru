/* eslint-disable @typescript-eslint/no-require-imports */
const x=require('./free-release-context.cjs');module.exports.context=()=>{x.assert.equal(process.argv[3],x.REF);return {...x,env:x.env(),load:()=>x.privateRead('v2-free-fixture.aes')}};
