import { test } from '@playwright/test';
import { BASE, pinBackend, settle, signIn } from '../helpers';
const CASES: [string, string | null, boolean, boolean][] = [['/ar/workforce/future', 'chco', false, true], ['/careers/horizons', null, true, false], ['/workforce/future', 'chco', false, false]];
for (const [path, persona, mobile] of CASES) {
  test(`dbg ${path} ${mobile}`, async ({ page }) => {
    await pinBackend(page, 'supabase');
    if (persona) await signIn(page, persona);
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + path);
    await settle(page);
    const r = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const out: string[] = [`scroll ${document.documentElement.scrollWidth} client ${W}`];
      for (const el of Array.from(document.querySelectorAll('main *'))) {
        const b = (el as HTMLElement).getBoundingClientRect();
        if (b.width > 0 && (b.right > W + 1 || b.left < -1)) {
          const p = el.parentElement?.getBoundingClientRect();
          if (p && (p.right > W + 1 || p.left < -1)) continue; // report the outermost only... skip children of overflowing parents
          out.push(`${el.tagName}.${(el as HTMLElement).className.toString().slice(0, 80)} [${(el as HTMLElement).dataset.testid ?? ''}] L${Math.round(b.left)} R${Math.round(b.right)} W${Math.round(b.width)}`);
        }
      }
      return out.slice(0, 15);
    });
    console.log(path, mobile, '\n' + r.join('\n'));
  });
}
