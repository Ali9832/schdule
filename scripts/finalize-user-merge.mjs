import fs from 'node:fs'
const test='scripts/check-bank-edit-browser.mjs'
fs.writeFileSync(test,fs.readFileSync(test,'utf8').replaceAll('H5','E03').replaceAll('H2','E01'))
const exporter='scripts/export-merged-workbook.ps1'
fs.writeFileSync(exporter,'\uFEFF'+fs.readFileSync(exporter,'utf8').replace(/^\uFEFF/,''))
