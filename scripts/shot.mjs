// Screenshots of the running dev server for visual checks.
// Usage: node scripts/shot.mjs [name] [--tab=cut] [--click=<text>]... [--scroll=<px>] (scrolls the cut plan)
// Writes shots/<name>-<tab>.png. Needs `npm run dev` on :5188.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--')) ?? 'app'
const opt = (k) => args.filter((a) => a.startsWith(`--${k}=`)).map((a) => a.slice(k.length + 3))
const url = process.env.URL ?? 'http://localhost:5188'

mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))

await page.goto(url)
if (args.includes('--fresh')) {
  await page.evaluate(() => localStorage.clear())
  await page.reload()
}
await page.waitForTimeout(1500)
for (const text of opt('click')) {
  await page.getByText(text, { exact: false }).first().click()
  await page.waitForTimeout(400)
}
for (const tab of opt('tab').length ? opt('tab') : ['layout']) {
  if (tab === 'cut') await page.getByRole('tab', { name: 'Cut plan' }).click()
  if (tab === 'layout') await page.getByRole('tab', { name: 'Shop layout' }).click()
  await page.waitForTimeout(1200)
  for (const y of opt('scroll')) await page.evaluate((y) => document.querySelector('.cutplan, .inspector')?.scrollTo(0, Number(y)), y)
  const file = `shots/${name}-${tab}.png`
  await page.screenshot({ path: file })
  console.log(file)
}
if (logs.length) console.log(logs.join('\n'))
await browser.close()
