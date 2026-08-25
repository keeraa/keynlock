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

  // Only the mechanical locks listen for now. Add a mode here once it has an
  // answer for what counts as noise in it.
  const NOISE_MODES = ['classic', 'target', 'line', 'sequence', 'special'];

  // `noise` itself is taken: audio.js has a noise generator, and classic
  // scripts share one scope.
  let noiseLevel = 0;
  let noiseWarned = false;
  let guardsCalled = false;
  let noiseBar = null, noiseFill = null;

  function noiseActive(){
    return NOISE_MODES.includes(mode) && !shopOpen && !lairOpen && !mapOpen;
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

  // Sit just above the objective line, wherever that has ended up: it moves
  // between breakpoints and this way the meter follows without its own copy of
  // every rule.
  function placeNoiseMeter(){
    if(!noiseBar) return;
    const line = document.querySelector('#objectiveLine');
    if(!line) return;
    const r = line.getBoundingClientRect();
    noiseBar.style.left = `${Math.round(r.left)}px`;
    noiseBar.style.width = `${Math.round(r.width)}px`;
    noiseBar.style.top = `${Math.round(r.top - noiseBar.offsetHeight - 6)}px`;
  }

  function renderNoise(){
    if(!noiseBar) return;
    const on = noiseActive() && !solved;
    noiseBar.classList.toggle('visible', on);
    if(!on) return;
    noiseFill.style.width = `${Math.min(100, noiseLevel * 100).toFixed(1)}%`;
    noiseBar.classList.toggle('warning', noiseLevel >= NOISE_WARN);
    placeNoiseMeter();
  }

  function addNoise(amount){
    if(!noiseActive() || solved || guardsCalled) return;
    noiseLevel = Math.min(1.2, noiseLevel + amount);
    if(noiseLevel >= NOISE_WARN && !noiseWarned){
      noiseWarned = true;
      SFX.alarm();
    }
    if(noiseLevel >= 1) guardsArrive();
    renderNoise();
  }

  function resetNoise(){
    noiseLevel = 0;
    noiseWarned = false;
    guardsCalled = false;
    renderNoise();
  }

  function guardsArrive(){
    if(guardsCalled) return;
    guardsCalled = true;
    solved = true;
    SFX.guards();
    if(typeof render === 'function') render();
    toast('Стража услышала · проигрыш');
    setTimeout(() => { resetNoise(); newLock(); }, 1600);
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
  function noiseTick(now){
    const dt = Math.min(200, now - noiseLast);
    noiseLast = now;
    if(noiseLevel > 0 && !guardsCalled){
      const before = noiseLevel;
      noiseLevel = Math.max(0, noiseLevel - NOISE_DECAY * (dt / 1000));
      if(noiseLevel < NOISE_WARN) noiseWarned = false;
      if(before !== noiseLevel) renderNoise();
    }
    const showing = noiseActive() && !solved;
    if(showing !== noiseWasShowing){ noiseWasShowing = showing; renderNoise(); }
    requestAnimationFrame(noiseTick);
  }

  buildNoiseMeter();
  renderNoise();
  addEventListener('resize', placeNoiseMeter, { passive:true });
  requestAnimationFrame(noiseTick);

  // ===== BIRDS =====
  // Something circles overhead and calls. Look up in time and it passes; miss it
  // and it comes down on you, which is most of the noise meter in one go.

  const BIRD_GAP_MIN = 14000;    // ms between sightings, low end
  const BIRD_GAP_MAX = 26000;    // ...and high end
  const BIRD_WARN_MS = 2600;     // how long you have to notice it
  const BIRD_NOISE_HIT = 0.60;   // what an unnoticed bird costs
  const BIRD_LOOK_UP = -0.55;    // share of the upward sweep that counts as looking up

  // Tilt only decides this where there is a device to tilt. On a desktop the
  // cursor drifts to the top of the scene all the time, which would dodge birds
  // by accident — there you click the thing instead.
  const birdTiltLayout = window.matchMedia('(pointer:coarse)');

  let birdEl = null, birdShadow = null;
  let birdState = 'idle';        // idle | warning
  let birdTimer = 0, birdDeadline = 0;

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
    birdEl.addEventListener('click', () => noticeBird('click'));
    document.body.appendChild(birdEl);

    birdShadow = document.createElement('div');
    birdShadow.className = 'birdShadow';
    birdShadow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(birdShadow);
  }

  function birdsActive(){ return noiseActive() && !solved && !guardsCalled; }

  function scheduleBird(){
    clearTimeout(birdTimer);
    const gap = BIRD_GAP_MIN + Math.random() * (BIRD_GAP_MAX - BIRD_GAP_MIN);
    birdTimer = setTimeout(sendBird, gap);
  }

  function sendBird(){
    if(!birdsActive()){ scheduleBird(); return; }
    birdState = 'warning';
    birdDeadline = performance.now() + BIRD_WARN_MS;

    // Fly it across the sky above the lock, and drag its shadow over the plates
    // so the warning still lands with the sound off.
    const fromLeft = Math.random() < 0.5;
    birdEl.style.setProperty('--bird-from', fromLeft ? '-14vw' : '108vw');
    birdEl.style.setProperty('--bird-to', fromLeft ? '108vw' : '-14vw');
    birdEl.classList.remove('passing');
    birdEl.classList.add('active');
    const plates = document.querySelector('.platesZone');
    if(plates){
      const r = plates.getBoundingClientRect();
      birdShadow.style.top = `${Math.round(r.top)}px`;
      birdShadow.style.height = `${Math.round(r.height)}px`;
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
    birdEl.classList.toggle('passing', passed);
    birdEl.classList.remove('active');
    birdShadow.classList.remove('active');
    clearTimeout(birdTimer);
    clearInterval(birdLookTimer);
    scheduleBird();
  }

  function noticeBird(){
    if(birdState !== 'warning') return;
    toast('Птица прошла мимо');
    endBird(true);
  }

  function birdStrike(){
    if(birdState !== 'warning') return;
    endBird(false);
    if(!birdsActive()) return;
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
  let birdLookTimer = 0;
  function watchForLookUp(){
    clearInterval(birdLookTimer);
    if(!birdTiltLayout.matches) return;
    birdLookTimer = setInterval(() => {
      if(birdState !== 'warning'){ clearInterval(birdLookTimer); return; }
      if(pointerTargetY <= BIRD_LOOK_UP * 30) noticeBird();
    }, 60);
  }

  buildBird();
  scheduleBird();
