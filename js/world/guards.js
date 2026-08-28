  // ===== NOISE SENSOR / GUARDS =====
  // Every action carries a little noise and errors carry a lot; the level bleeds
  // off on its own, so haste is what gets punished rather than thinking. Fill
  // the meter and the guards come running, which ends the round.

  // Tuning lives here on purpose — these are meant to be moved around.
  const NOISE_PER_MOVE = 0.040;   // an ordinary pin move
  const NOISE_PER_BLOCKED = 0.150; // a move the lock refuses
  const NOISE_PER_BREAK = 0.210;  // a pick snapping
  const NOISE_PER_WRONG = 0.190;  // wrong tensioner
  const NOISE_DECAY = 0.075;      // per second, back towards silence
  const NOISE_WARN = 0.68;        // where the meter starts warning

  // `noise` itself is taken: audio.js has a noise generator, and classic
  // scripts share one scope.
  let noiseLevel = 0;
  let noiseWarned = false;
  let guardsCalled = false;
  let noiseBar = null, noiseFill = null;

  function noiseActive(){
    return !!GameCatalog.feature(mode,'world.noise') && !shopOpen && !lairOpen && !mapOpen;
  }

  function guardsActive(){
    return !!GameCatalog.feature(mode,'world.guards') && noiseActive();
  }

  function noiseSensorActive(){
    return !!GameCatalog.feature(mode,'world.noiseSensor') && noiseActive();
  }

  let guardFace = null;
  function buildGuardFace(){
    if(guardFace) return;
    guardFace = document.createElement('div');
    guardFace.className = 'guardWatch';
    guardFace.id = 'guardWatch';
    guardFace.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = 'assets/guards/guard_01_face.png';
    img.alt = '';
    guardFace.appendChild(img);
    document.body.appendChild(guardFace);
  }

  // Leans further in the louder it gets, so the guard is a warning before he is
  // a verdict.
  function renderGuardFace(){
    if(!guardFace) return;
    const alert = guardsActive() && !solved
      ? Math.max(0, (noiseLevel - NOISE_WARN) / (1 - NOISE_WARN))
      : 0;
    guardFace.style.setProperty('--guard-alert', Math.min(1, alert).toFixed(3));
    guardFace.classList.toggle('watching', alert > 0);
  }

  function buildNoiseMeter(){
    if(noiseBar) return;
    noiseBar = document.createElement('div');
    noiseBar.className = 'noiseMeter';
    noiseBar.id = 'noiseMeter';
    noiseBar.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'noiseMeterLabel';
    label.textContent = 'ШУМ';
    const track = document.createElement('span');
    track.className = 'noiseMeterTrack';
    noiseFill = document.createElement('i');
    noiseFill.className = 'noiseMeterFill';
    track.appendChild(noiseFill);
    noiseBar.append(label, track);
    document.body.appendChild(noiseBar);
  }

  // Keep a stable viewport position and clear coordinates left by older builds.
  function placeNoiseMeter(){
    if(!noiseBar) return;
    noiseBar.style.removeProperty('left');
    noiseBar.style.removeProperty('width');
    noiseBar.style.removeProperty('top');
  }

  function renderNoise(){
    if(!noiseBar) return;
    const on = noiseSensorActive() && !solved;
    noiseBar.classList.toggle('visible', on);
    if(!on){ renderGuardFace(); return; }
    noiseFill.style.height = `${Math.min(100, noiseLevel * 100).toFixed(1)}%`;
    noiseBar.classList.toggle('warning', noiseLevel >= NOISE_WARN);
    renderGuardFace();
    placeNoiseMeter();
  }

  function addNoise(amount){
    if(!noiseActive() || solved || guardsCalled) return;
    noiseLevel = Math.min(1.2, noiseLevel + amount);
    if(noiseLevel >= NOISE_WARN && !noiseWarned){
      noiseWarned = true;
      SFX.alarm();
    }
    if(noiseLevel >= 1 && guardsActive()) guardsArrive();
    renderNoise();
  }

  function resetNoise(){
    guardFace?.classList.remove('caught');
    noiseLevel = 0;
    noiseWarned = false;
    guardsCalled = false;
    renderNoise();
  }

  function guardsArrive(){
    if(guardsCalled || !guardsActive()) return;
    guardsCalled = true;
    guardFace?.classList.add('caught');
    SFX.guards();
    if(typeof render === 'function') render();
    showGameDefeat('noise');
  }

  // Wrapping the sounds catches every game at once: anything that makes a noiseLevel
  // the player can hear is a noiseLevel a guard can hear.
  const baseMove = SFX.move, baseBlocked = SFX.blocked;
  const baseBreak = SFX.break, baseWrong = SFX.wrongLock;
  SFX.move = function(){ addNoise(NOISE_PER_MOVE); return baseMove.apply(this, arguments); };
  SFX.blocked = function(){ addNoise(NOISE_PER_BLOCKED); return baseBlocked.apply(this, arguments); };
  SFX.break = function(){ addNoise(NOISE_PER_BREAK); return baseBreak.apply(this, arguments); };
  SFX.wrongLock = function(){ addNoise(NOISE_PER_WRONG); return baseWrong.apply(this, arguments); };

  const baseNewLockForNoise = newLock;
  newLock = function(){
    const out = baseNewLockForNoise.apply(this, arguments);
    resetNoise();
    return out;
  };

  let noiseLast = performance.now();
  let noiseWasShowing = null;
  let noiseLoopParked = false;
  function noiseTick(now){
    if(isWorldPaused()){ noiseLoopParked=true; return; }
    noiseLoopParked=false;
    const dt = Math.min(200, now - noiseLast);
    noiseLast = now;
    if(noiseLevel > 0 && !guardsCalled){
      const before = noiseLevel;
      noiseLevel = Math.max(0, noiseLevel - NOISE_DECAY * (dt / 1000));
      if(noiseLevel < NOISE_WARN) noiseWarned = false;
      if(before !== noiseLevel) renderNoise();
    }
    const showing = noiseSensorActive() && !solved;
    if(showing !== noiseWasShowing){ noiseWasShowing = showing; renderNoise(); }
    setTimeout(()=>requestAnimationFrame(noiseTick),100);
  }
  window.addEventListener('keynlock-world-pausechange',event=>{
    if(!event.detail?.paused && noiseLoopParked){
      noiseLoopParked=false;
      noiseLast=performance.now();
      requestAnimationFrame(noiseTick);
    }
  });

  buildGuardFace();
  buildNoiseMeter();
  renderNoise();
  window.addEventListener('keynlock-game-catalog-change',event=>{
    if(!event.detail?.id || event.detail.id===mode)renderNoise();
  });
  addEventListener('resize', placeNoiseMeter, { passive:true });
  requestAnimationFrame(noiseTick);

  // ===== BIRDS =====
  // Something circles overhead and calls. Look up in time and it passes; miss it
  // and it comes down on you, which is most of the noise meter in one go.

  const BIRD_GAP_MIN = 14000;    // ms between sightings, low end
  const BIRD_GAP_MAX = 26000;    // ...and high end
  const BIRD_WARN_MS = 5200;     // how long it circles before it comes down
  const BIRD_HOLD_MS = 1500;     // how long you have to keep watching it
  const BIRD_NOISE_HIT = 0.60;   // what an unnoticed bird costs
  const BIRD_LOOK_UP = -0.55;    // share of the upward sweep that counts as looking up

  // "Looking up" is raising your gaze on either device: tipping the phone, or
  // moving the cursor to the top of the scene. Both already drive pointerTargetY
  // — only the size of the sweep differs.
  const birdTiltLayout = window.matchMedia('(pointer:coarse)');
  const birdSweep = () => (birdTiltLayout.matches
    ? (window.TILT_SWEEP_Y || 58)
    : (window.POINTER_SWEEP_Y || 11));

  let birdEl = null, birdShadow = null;
  let birdState = 'idle';        // idle | warning
  let birdTimer = 0, birdDeadline = 0;
  let birdWatchedMs = 0;         // how long it has been held in view

  function buildBird(){
    if(birdEl) return;
    birdEl = document.createElement('button');
    birdEl.type = 'button';
    birdEl.className = 'skyBird';
    birdEl.id = 'skyBird';
    birdEl.setAttribute('aria-label', 'Заметить птицу');
    // Placeholder silhouette — swap this markup for the real artwork.
    birdEl.innerHTML = '<svg viewBox="0 0 64 24" aria-hidden="true">'
      + '<path d="M2 18 C12 4 22 4 32 14 C42 4 52 4 62 18" />'
      + '</svg>';
    // On a desktop watching means keeping the cursor on it, which is the same
    // "hold your attention there" the tilt asks for rather than a stray click.
    birdEl.addEventListener('pointerenter', () => { birdHovered = true; });
    birdEl.addEventListener('pointerleave', () => { birdHovered = false; });
    document.body.appendChild(birdEl);

    birdShadow = document.createElement('div');
    birdShadow.className = 'birdShadow';
    birdShadow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(birdShadow);
  }

  function birdsActive(){
    return !!GameCatalog.feature(mode,'world.birds') && noiseActive() && !solved && !guardsCalled;
  }

  function scheduleBird(){
    clearTimeout(birdTimer);
    if(isWorldPaused()){ birdTimer=0; return; }
    const gap = BIRD_GAP_MIN + Math.random() * (BIRD_GAP_MAX - BIRD_GAP_MIN);
    birdTimer = setTimeout(sendBird, gap);
  }

  let birdHovered = false;

  function sendBird(){
    if(isWorldPaused()){ scheduleBird(); return; }
    if(!birdsActive()){ scheduleBird(); return; }
    birdState = 'warning';
    birdWatchedMs = 0;
    birdHovered = false;
    birdDeadline = performance.now() + BIRD_WARN_MS;

    // Fly it across the sky above the lock, and drag its shadow over the plates
    // so the warning still lands with the sound off.
    const fromLeft = Math.random() < 0.5;
    birdEl.style.setProperty('--bird-from', fromLeft ? '-14vw' : '108vw');
    birdEl.style.setProperty('--bird-to', fromLeft ? '108vw' : '-14vw');
    // Flight and deadline come from the same number: they drifted apart once
    // and left the bird off-screen for two seconds before the blow landed.
    birdEl.style.setProperty('--bird-flight', `${BIRD_WARN_MS}ms`);
    birdShadow.style.setProperty('--bird-flight', `${BIRD_WARN_MS}ms`);
    birdEl.classList.remove('passing');
    birdEl.classList.add('active');
    // Measure the plate stack, not .platesZone: the zone is a fixed 455px box
    // with dead space below the rows, and a shadow spilling onto the backdrop
    // there is what made it read as a background effect.
    const rows = [...document.querySelectorAll('.plate')].map(p => p.getBoundingClientRect());
    if(rows.length){
      const top = Math.min(...rows.map(r => r.top));
      const bottom = Math.max(...rows.map(r => r.bottom));
      birdShadow.style.top = `${Math.round(top)}px`;
      birdShadow.style.height = `${Math.round(bottom - top)}px`;
    }
    birdShadow.style.setProperty('--bird-from', fromLeft ? '-30vw' : '110vw');
    birdShadow.style.setProperty('--bird-to', fromLeft ? '110vw' : '-30vw');
    birdShadow.classList.add('active');

    SFX.bird();
    watchForLookUp();
    clearTimeout(birdTimer);
    birdTimer = setTimeout(birdStrike, BIRD_WARN_MS);
  }

  function endBird(passed){
    birdState = 'idle';
    birdWatchedMs = 0;
    birdHovered = false;
    birdEl.classList.remove('watched');
    birdEl.style.removeProperty('--bird-watch');
    birdEl.classList.toggle('passing', passed);
    birdEl.classList.remove('active');
    birdShadow.classList.remove('active');
    clearTimeout(birdTimer);
    clearInterval(birdLookTimer);
    scheduleBird();
  }

  function noticeBird(){
    if(birdState !== 'warning') return;
    toast('Птица улетела');
    endBird(true);
  }

  let hitMark = null;
  function flashHitFromAbove(){
    if(!hitMark){
      hitMark = document.createElement('div');
      hitMark.className = 'hitMark';
      hitMark.setAttribute('aria-hidden', 'true');
      document.body.appendChild(hitMark);
    }
    hitMark.classList.remove('show');
    void hitMark.offsetWidth;
    hitMark.classList.add('show');
  }

  function birdStrike(){
    if(birdState !== 'warning') return;
    endBird(false);
    if(!birdsActive()) return;
    flashHitFromAbove();
    SFX.birdHit();
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
    toast('Птица заметила тебя · шум');
    addNoise(BIRD_NOISE_HIT);
  }

  // Looking up is the same gesture the parallax already reads: on a phone the
  // top of the device tips away from you, which drives pointerTargetY negative.
  // Polled on a timer rather than rAF — this has a deadline, and rAF stops
  // whenever the page is not compositing.
  // Glancing up is not enough — you have to keep looking, which is what makes
  // it a real interruption rather than a reflex. Time spent watching is
  // accumulated, so looking away and back still counts.
  const BIRD_TICK = 60;
  let birdLookTimer = 0, birdLookLast = 0;
  function watchForLookUp(){
    clearInterval(birdLookTimer);
    birdLookLast = performance.now();
    birdLookTimer = setInterval(() => {
      if(birdState !== 'warning'){ clearInterval(birdLookTimer); return; }
      // Count real elapsed time, not one tick per callback: timers stretch when
      // the page is busy, and a stretched tick would otherwise steal from the
      // player's hold.
      const now = performance.now();
      const dt = Math.min(250, now - birdLookLast);
      birdLookLast = now;
      const lookingUp = pointerTargetY <= BIRD_LOOK_UP * birdSweep();
      const watching = lookingUp || birdHovered;
      if(watching) birdWatchedMs += dt;
      birdEl.classList.toggle('watched', watching);
      birdEl.style.setProperty('--bird-watch', Math.min(1, birdWatchedMs / BIRD_HOLD_MS).toFixed(3));
      if(birdWatchedMs >= BIRD_HOLD_MS) noticeBird();
    }, BIRD_TICK);
  }

  window.addEventListener('keynlock-world-pausechange',event=>{
    if(event.detail?.paused){
      clearTimeout(birdTimer);
      clearInterval(birdLookTimer);
      birdTimer=0;
      birdState='idle';
      birdWatchedMs=0;
      birdHovered=false;
      birdEl?.classList.remove('active','passing','watched');
      birdShadow?.classList.remove('active');
      return;
    }
    scheduleBird();
  });

  buildBird();
  scheduleBird();
