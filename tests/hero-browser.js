// oxlint-disable-next-line no-unused-expressions -- playwright-cli evaluates this file as a function expression.
async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const manifest = await (await page.request.get('http://127.0.0.1:5173/frames/manifest.json')).json();
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const state = () => page.evaluate(() => ({
    painted: Number(document.querySelector('canvas').dataset.paintedFrame),
    wanted: Number(document.querySelector('canvas').dataset.wantedFrame),
    renders: Number(document.querySelector('canvas').dataset.renderCount),
    ready: document.querySelector('canvas').dataset.ready,
    cache: Number(document.querySelector('#home').dataset.cacheSize),
    capacity: Number(document.querySelector('#home').dataset.cacheCapacity),
    inflight: Number(document.querySelector('#home').dataset.inflight),
    overflow: document.documentElement.scrollWidth > innerWidth,
    y: scrollY,
  }));
  const seek = async progress => {
    await page.evaluate(p => {
      const section = document.querySelector('#home');
      const stage = document.querySelector('.hero-viewport');
      window.scrollTo(0, section.offsetTop + (section.offsetHeight - stage.offsetHeight) * p);
    }, progress);
    const expected = Math.round(progress * (manifest.frameCount - 1)) + 1;
    await page.waitForFunction(n => Number(document.querySelector('canvas').dataset.paintedFrame) === n, expected);
    const current = await state();
    check(current.wanted === expected, `Wanted mismatch at ${progress}`);
    check(current.ready === 'true', 'Canvas blank');
    check(current.cache <= current.capacity, 'Cache exceeded cap');
    check(current.inflight <= 4, 'Request pool exceeded cap');
    return current;
  };
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => document.querySelector('canvas').dataset.paintedFrame === '1');
  const start = await state();
  check(!start.overflow, 'Desktop overflow');
  const points = [];
  for (const p of [0, .25, .5, .75, 1, .75, .5, .25, 0]) points.push({ progress: p, ...await seek(p) });
  const before = await state();
  await page.waitForTimeout(600);
  const after = await state();
  check(before.painted === after.painted && before.renders === after.renders, 'Idle frame animation');
  await page.screenshot({ path: 'artifacts/hero-desktop.png' });
  await seek(.5);
  await page.screenshot({ path: 'artifacts/hero-desktop-middle.png' });
  await seek(1);
  await page.screenshot({ path: 'artifacts/hero-desktop-final.png' });
  await page.evaluate(() => scrollBy(0, 450));
  await page.waitForTimeout(100);
  const release = await page.evaluate(() => ({ stageTop: document.querySelector('.hero-viewport').getBoundingClientRect().top, nextTop: document.querySelector('#after-hero').getBoundingClientRect().top }));
  check(release.stageTop < -400 && release.nextTop < 900, 'Hero did not release');
  const sizes = [];
  for (const [width, height] of [[768,1024],[375,812]]) {
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:5173/');
    await page.waitForFunction(() => document.querySelector('canvas').dataset.paintedFrame === '1');
    check(!(await state()).overflow, `Overflow at ${width}`);
    await page.screenshot({path:`artifacts/hero-${width}.png`});
    sizes.push({width,height,start:await state(),middle:await seek(.5),end:await seek(1)});
  }
  const requests = [];
  await page.route('**/frames/**', async route => { requests.push(route.request().url()); await route.continue(); });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => document.querySelector('.hero-poster').complete);
  await page.waitForTimeout(300);
  check(requests.length === 0, 'Reduced motion fetched sequence or manifest');
  const reduced = await page.evaluate(() => ({height:document.querySelector('#home').offsetHeight,viewport:innerHeight,static:document.querySelector('#home').dataset.static,poster:document.querySelector('.hero-poster').naturalWidth}));
  check(reduced.static === 'true' && reduced.height <= reduced.viewport + 1 && reduced.poster > 0, 'Reduced motion fallback invalid');
  await page.screenshot({path:'artifacts/hero-reduced-motion.png'});
  await page.unroute('**/frames/**');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForFunction(() => document.querySelector('canvas').dataset.paintedFrame === '1');
  await seek(.5);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(() => document.querySelector('#home').dataset.static === 'true');
  check((await state()).y === 0,'Live reduced-motion switch lost hero reading position');
  check(errors.length === 0,errors.join('\n'));
  return {desktop:points, idle:before.painted === after.painted,release,sizes,reduced,reducedSequenceRequests:requests.length,livePreference:true,errors};
}
