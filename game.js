/**
 * XCARET BATTLES - SHOOT'EM UP VERTICAL (DESKTOP EDITION)
 * Protagonista: Guacamaya
 * Desarrollado con Canvas HTML5, Web Audio API & Audio Loop
 */

(() => {
  'use strict';

  // --- CONFIGURACIÓN Y ESTADO PRINCIPAL (TAMAÑO DESKTOP 16:9) ---
  const CANVAS_WIDTH = 1280;
  const CANVAS_HEIGHT = 720;
  const TARGET_FRUITS = 10;

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('canvas-container');

  const STATES = {
    LOADING: 'LOADING',
    TITLE: 'TITLE',
    PLAYING: 'PLAYING',
    GAMEOVER: 'GAMEOVER',
    VICTORY: 'VICTORY'
  };

  let currentState = STATES.LOADING;
  let lastTime = performance.now();
  let globalTime = 0;
  let screenShake = 0;
  let gameOverTimer = 0;

  // --- GESTIÓN DE AUDIO PROCEDURAL Y MÚSICA EN BUCLE (Song.mp3) ---
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.bgm = null;
      this.bgmStarted = false;
      this.intro = null;
      this.introWanted = false;
      this.introSynced = false;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this.initBGM();
    }

    initBGM() {
      if (!this.bgm) {
        this.bgm = new Audio();
        this.bgm.preload = 'auto';
        this.bgm.loop = true;
        this.bgm.volume = 0.65;
        this.bgm.addEventListener('error', () => {
          if (this.bgm && this.bgm.src.includes('assets/')) {
            this.bgm.src = 'Song.mp3';
            this.bgm.load();
          }
        });
        this.bgm.src = 'assets/Song.mp3';
        this.bgm.load(); // empieza a descargar de inmediato
      }
    }

    initIntro() {
      if (!this.intro) {
        this.intro = new Audio();
        this.intro.preload = 'auto';
        this.intro.loop = true;
        this.intro.volume = 0.65;
        this.intro.addEventListener('error', () => {
          if (this.intro && this.intro.src.includes('assets/')) {
            this.intro.src = 'SongIntro.mp3'; // misma carpeta que index.html
            this.intro.load();
          } else {
            console.warn('No se encontró SongIntro.mp3 (ni en assets/ ni junto a index.html)');
          }
        });
        // Cuando la música realmente empieza, el video arranca desde el inicio (van juntos)
        this.intro.addEventListener('playing', () => {
          if (!this.introSynced) {
            this.introSynced = true;
            titleVideo.restart();
          }
        });
        // Si se pidió reproducir antes de que el archivo estuviera listo, arranca al estar listo
        this.intro.addEventListener('canplay', () => {
          if (this.introWanted && !this.muted && this.intro.paused) {
            this.intro.play().catch(() => {});
          }
        });
        this.intro.src = 'assets/SongIntro.mp3';
        this.intro.load();
      }
    }

    // Música de la pantalla inicial. Si el navegador la bloquea (autoplay),
    // se reintenta con la primera tecla que se presione en el título.
    playIntro() {
      this.initIntro();
      titleVideo.play(); // el video es mudo: siempre puede arrancar
      this.introWanted = true;
      if (this.intro && !this.muted && this.intro.paused) {
        const p = this.intro.play();
        if (p && p.catch) {
          p.catch(err => console.warn('SongIntro.mp3 no pudo reproducirse todavía:', err && err.name));
        }
      }
    }

    // Celular: al cambiar de app o bloquear la pantalla, la música se pausa
    pauseForBackground() {
      if (titleVideo.el) titleVideo.el.pause();
      if (this.bgm) this.bgm.pause();
      if (this.intro) this.intro.pause();
    }

    resumeFromBackground() {
      if (this.muted) return;
      if (currentState === STATES.TITLE) {
        if (titleVideo.wanted && titleVideo.el) titleVideo.el.play().catch(() => {});
        if (this.introWanted && this.intro) this.intro.play().catch(() => {});
      } else if (this.bgmStarted && this.bgm) {
        this.bgm.play().catch(() => {});
      }
    }

    stopIntro() {
      this.introWanted = false;
      this.introSynced = false;
      titleVideo.stop();
      if (this.intro) {
        this.intro.pause();
        this.intro.currentTime = 0;
      }
    }

    playBGM() {
      this.init();
      if (this.bgm && !this.muted) {
        if (!this.bgmStarted) this.bgm.currentTime = 0;
        // Se llama dentro del clic/tecla de Press Start, así que el navegador lo permite
        const p = this.bgm.play();
        if (p && p.then) {
          p.then(() => { this.bgmStarted = true; }).catch(() => {});
        }
      }
    }

    stopBGM() {
      if (this.bgm) {
        this.bgm.pause();
        this.bgm.currentTime = 0;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (this.bgm) {
        this.bgm.muted = this.muted;
      }
      if (this.intro) {
        this.intro.muted = this.muted;
      }
      const btn = document.getElementById('btn-sound');
      if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
      return this.muted;
    }

    playShoot() {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(240, t + 0.11);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.11);
      } catch (e) {}
    }

    playEnemyShoot() {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 0.16);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.16);
      } catch (e) {}
    }

    playHit() {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(420, t);
        osc.frequency.linearRampToValueAtTime(160, t + 0.05);

        gain.gain.setValueAtTime(0.14, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.05);
      } catch (e) {}
    }

    playExplosion() {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + 0.32);

        gain.gain.setValueAtTime(0.38, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.32);
      } catch (e) {}
    }

    playFruit() {
      if (this.muted || !this.ctx) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const t = this.ctx.currentTime + idx * 0.05;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);

          gain.gain.setValueAtTime(0.22, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.14);
        });
      } catch (e) {}
    }

    playPlayerDeath() {
      if (this.muted || !this.ctx) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(360, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.6);

        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(t);
        osc.stop(t + 0.6);
      } catch (e) {}
    }

    playVictory() {
      if (this.muted || !this.ctx) return;
      try {
        const melody = [
          { f: 523.25, d: 0.12, pause: 0 },
          { f: 659.25, d: 0.12, pause: 0.13 },
          { f: 783.99, d: 0.12, pause: 0.26 },
          { f: 1046.5, d: 0.45, pause: 0.40 }
        ];

        melody.forEach(n => {
          const t = this.ctx.currentTime + n.pause;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(n.f, t);

          gain.gain.setValueAtTime(0.25, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + n.d);
        });
      } catch (e) {}
    }
  }

  const sound = new SoundManager();
  sound.initBGM(); // precarga Song.mp3 desde el inicio
  sound.initIntro(); // precarga SongIntro.mp3 (solo pantalla inicial)

  // --- VIDEO DE LA PANTALLA INICIAL (LoopAnimado.mp4) ---
  // El video va sin sonido (el audio es SongIntro.mp3), por eso el navegador
  // sí permite que arranque solo. Se dibuja en el canvas detrás del botón Press Start.
  const titleVideo = {
    el: null,
    failed: false,
    wanted: false,

    init() {
      if (this.el) return;
      const v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'auto';
      v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;';
      v.addEventListener('error', () => {
        if (v.src.includes('assets/')) {
          v.src = 'LoopAnimado.mp4'; // misma carpeta que index.html
          v.load();
        } else {
          this.failed = true;
          console.warn('No se encontró LoopAnimado.mp4 (ni en assets/ ni junto a index.html)');
        }
      });
      v.addEventListener('canplay', () => {
        if (this.wanted && v.paused) v.play().catch(() => {});
      });
      v.src = 'assets/LoopAnimado.mp4';
      document.body.appendChild(v);
      this.el = v;
    },

    play() {
      this.init();
      this.wanted = true;
      if (this.el.paused) this.el.play().catch(() => {});
    },

    stop() {
      this.wanted = false;
      if (this.el) this.el.pause();
    },

    // Reinicia el video para que arranque junto con la música
    restart() {
      if (!this.el) return;
      try { this.el.currentTime = 0; } catch (e) {}
      if (this.wanted && this.el.paused) this.el.play().catch(() => {});
    },

    ready() {
      return !!this.el && !this.failed && this.el.readyState >= 2 && this.el.videoWidth > 0;
    },

    // Rellena todo el canvas (recorta lo que sobre, sin deformar)
    draw() {
      const v = this.el;
      const k = Math.max(CANVAS_WIDTH / v.videoWidth, CANVAS_HEIGHT / v.videoHeight);
      const w = v.videoWidth * k;
      const h = v.videoHeight * k;
      ctx.drawImage(v, (CANVAS_WIDTH - w) / 2, (CANVAS_HEIGHT - h) / 2, w, h);
    }
  };
  titleVideo.init(); // empieza a descargar LoopAnimado.mp4 desde que abre la página

  // --- CARGADOR DE RECURSOS ---
  const assets = {
    bg: null,
    enemy: null,
    fruit: null,
    guacamayaLeft: null,
    guacamayaRight: null,
    headCounter: null,
    gameover: null,
    retry: null,
    ventana: null,
    winner: null,
    pres: null,
    pressStart: null,
    seed: null
  };

  const assetList = [
    { key: 'bg', src: 'assets/Background.png', fallback: 'Background.png' },
    { key: 'enemy', src: 'assets/Enemy.png', fallback: 'Enemy.png' },
    { key: 'fruit', src: 'assets/fruit.png', fallback: 'Fruit.png' },
    { key: 'guacamayaLeft', src: 'assets/Guacamaya_Left.png', fallback: 'Guacamaya_Left.png' },
    { key: 'guacamayaRight', src: 'assets/Guacamaya_Right.png', fallback: 'Guacamaya_Right.png' },
    { key: 'headCounter', src: 'assets/Head and Counter.png', fallback: 'Head and Counter.png' },
    { key: 'gameover', src: 'assets/GameOver.png', fallback: 'GameOver.png' },
    { key: 'retry', src: 'assets/Reintentar.png', fallback: 'Reintentar.png' },
    { key: 'ventana', src: 'assets/Ventana.png', fallback: 'Ventana.png' },
    { key: 'winner', src: 'assets/Winner.png', fallback: 'Winner.png' },
    { key: 'pres', src: 'assets/Pres.png', fallback: 'Pres.png' },
    { key: 'pressStart', src: 'assets/Press Start.png', fallback: 'Press Start.png' },
    { key: 'seed', src: 'assets/Seed.png', fallback: 'Seed.png' }
  ];

  let loadedAssets = 0;
  function loadAssets(callback) {
    let finished = false;
    assetList.forEach(item => {
      const img = new Image();
      let triedFallback = false;

      img.onload = () => {
        loadedAssets++;
        assets[item.key] = img;
        if (loadedAssets === assetList.length && !finished) {
          finished = true;
          callback();
        }
      };

      img.onerror = () => {
        if (!triedFallback) {
          triedFallback = true;
          img.src = item.fallback;
        } else {
          console.warn('No se pudo cargar:', item.src);
          loadedAssets++;
          if (loadedAssets === assetList.length && !finished) {
            finished = true;
            callback();
          }
        }
      };

      img.src = item.src;
    });
  }

  // --- GESTIÓN DE ENTRADAS ---
  const keys = {
    left: false,
    right: false,
    up: false,
    down: false,
    shoot: false
  };

  const mouse = {
    active: false,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 130,
    shooting: false
  };

  window.addEventListener('keydown', e => {
    sound.init(); // solo prepara el audio; la música inicia con Press Start
    if (currentState === STATES.TITLE && !['Space', 'KeyZ', 'Enter'].includes(e.code)) {
      sound.playIntro(); // por si el navegador bloqueó el autoplay
    }

    if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = true;
    if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = true;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = true;
    if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = true;
    if (['Space', 'KeyZ', 'Enter'].includes(e.code)) {
      keys.shoot = true;
      handleActionButton();
    }
    if (e.code === 'KeyM') sound.toggleMute();
    if (e.code === 'KeyF') toggleFullscreen();
  });

  window.addEventListener('keyup', e => {
    if (['ArrowUp', 'KeyW'].includes(e.code)) keys.up = false;
    if (['ArrowDown', 'KeyS'].includes(e.code)) keys.down = false;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
    if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
    if (['Space', 'KeyZ', 'Enter'].includes(e.code)) keys.shoot = false;
  });

  function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    mouse.x = Math.max(50, Math.min(CANVAS_WIDTH - 50, (clientX - rect.left) * scaleX));
    mouse.y = Math.max(140, Math.min(CANVAS_HEIGHT - 60, (clientY - rect.top) * scaleY));
  }

  canvas.addEventListener('mousemove', e => {
    mouse.active = true;
    updatePointer(e);
  });

  canvas.addEventListener('mousedown', e => {
    sound.init();
    mouse.active = true;
    mouse.shooting = true;
    updatePointer(e);
    handleActionButton(true);
  });

  window.addEventListener('mouseup', () => {
    mouse.shooting = false;
  });

  // --- CONTROLES TÁCTILES (CELULAR / TABLET) ---
  // Arrastrar el dedo mueve a la Guacamaya de forma RELATIVA (el dedo no tapa al
  // personaje) y dispara automáticamente mientras el dedo esté sobre la pantalla.
  const TOUCH_SENSITIVITY = 1.3;
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  const touch = { id: null, startX: 0, startY: 0, px: 0, py: 0, armedState: null };

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CANVAS_WIDTH / rect.width),
      y: (clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
    };
  }

  function findTouch(list, id) {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    sound.init();
    if (touch.id !== null) return; // ya hay un dedo controlando
    const t = e.changedTouches[0];
    touch.id = t.identifier;
    touch.armedState = currentState; // estado en el que empezó el toque
    if (currentState === STATES.PLAYING) {
      touch.startX = t.clientX;
      touch.startY = t.clientY;
      touch.px = player.x;
      touch.py = player.y;
      mouse.active = true;
      mouse.x = player.x;
      mouse.y = player.y;
      mouse.shooting = true;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (touch.id === null || currentState !== STATES.PLAYING) return;
    const t = findTouch(e.touches, touch.id);
    if (!t) return;
    const rect = canvas.getBoundingClientRect();
    const dx = (t.clientX - touch.startX) * (CANVAS_WIDTH / rect.width) * TOUCH_SENSITIVITY;
    const dy = (t.clientY - touch.startY) * (CANVAS_HEIGHT / rect.height) * TOUCH_SENSITIVITY;
    mouse.active = true;
    mouse.x = Math.max(55, Math.min(CANVAS_WIDTH - 55, touch.px + dx));
    mouse.y = Math.max(150, Math.min(CANVAS_HEIGHT - 65, touch.py + dy));
  }, { passive: false });

  function endTouch(e, cancelled) {
    e.preventDefault();
    sound.init(); // iOS solo desbloquea el audio al SOLTAR el dedo
    const t = findTouch(e.changedTouches, touch.id);
    if (!t) return;

    const armedState = touch.armedState;
    touch.id = null;
    touch.armedState = null;
    mouse.shooting = false;

    // Los menús responden al "toque" (soltar), nunca a un toque que empezó jugando
    if (cancelled || armedState === STATES.PLAYING || armedState !== currentState) return;

    const pt = toCanvas(t.clientX, t.clientY);
    if (currentState === STATES.TITLE) {
      if (isOverPressStart(pt.x, pt.y, 60)) {
        enterMobileFullscreen();
        startGame();
      } else {
        sound.playIntro(); // un toque fuera del botón activa el audio
      }
    } else if (currentState === STATES.GAMEOVER) {
      if (gameOverTimer > 0.5) restartGame(); // evita reinicios por toques accidentales
    } else if (currentState === STATES.VICTORY) {
      restartGame();
    }
  }

  canvas.addEventListener('touchend', e => endTouch(e, false), { passive: false });
  canvas.addEventListener('touchcancel', e => endTouch(e, true), { passive: false });

  // Pantalla completa + orientación horizontal (Android/Chrome). En iPhone Safari
  // no existe pantalla completa para páginas: se ajusta solo a toda la pantalla.
  function enterMobileFullscreen() {
    if (!isTouchDevice) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) return;
    const req = container.requestFullscreen || container.webkitRequestFullscreen;
    if (!req) return;
    try {
      const lockLandscape = () => {
        try { screen.orientation?.lock?.('landscape').catch(() => {}); } catch (e) {}
      };
      const r = req.call(container, { navigationUI: 'hide' });
      if (r && r.then) r.then(lockLandscape).catch(() => {});
      else lockLandscape();
    } catch (e) {}
  }

  // Área del botón Press Start (250x55 centrado, y = alto - 135) con margen
  function isOverPressStart(px = mouse.x, py = mouse.y, pad = 24) {
    const x0 = (CANVAS_WIDTH - 250) / 2 - pad;
    const y0 = CANVAS_HEIGHT - 135 - pad;
    return px >= x0 && px <= x0 + 250 + pad * 2 &&
           py >= y0 && py <= y0 + 55 + pad * 2;
  }

  function handleActionButton(fromPointer = false) {
    if (currentState === STATES.TITLE) {
      if (fromPointer && !isOverPressStart()) {
        // Un clic fuera del botón sirve para activar el audio: suena SongIntro.mp3
        sound.playIntro();
        return;
      }
      startGame();
    } else if (currentState === STATES.GAMEOVER || currentState === STATES.VICTORY) {
      restartGame();
    }
  }

  document.getElementById('btn-sound')?.addEventListener('click', () => {
    sound.init();
    sound.toggleMute();
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      container.requestFullscreen?.() || container.webkitRequestFullscreen?.();
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    }
  }

  document.getElementById('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

  // --- ENTIDADES Y SISTEMA DE PARTÍCULAS ---
  let particles = [];
  function createFeatherExplosion(x, y, isPlayer = false) {
    const count = isPlayer ? 45 : 22;
    const colors = isPlayer 
      ? ['#ff2a2a', '#0070f3', '#00d084', '#ffd700'] 
      : ['#28a745', '#70d62a', '#ff9900', '#1f5326'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 260;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3.5 + Math.random() * 5.5,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 8,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3
      });
    }
  }

  function createFruitSparkles(x, y) {
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 160;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#ff4071', '#54e38e', '#ffffff', '#ffe17d'][Math.floor(Math.random() * 4)],
        size: 3 + Math.random() * 4,
        rotation: 0,
        vRot: 0,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0
      });
    }
  }

  let floatTexts = [];
  function addFloatText(x, y, text, color = '#ffeb85') {
    floatTexts.push({
      x,
      y,
      text,
      color,
      vy: -50,
      life: 0.9,
      maxLife: 0.9
    });
  }

  // Jugador: Guacamaya
  const player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 130,
    width: 86,
    height: 98,
    hitRadius: 20,
    speed: 460,
    vx: 0,
    vy: 0,
    direction: 'right',
    shootCooldown: 0,
    shootInterval: 0.16,
    invulnerableTime: 2.0,
    alive: true,

    reset() {
      this.x = CANVAS_WIDTH / 2;
      this.y = CANVAS_HEIGHT - 130;
      this.vx = 0;
      this.vy = 0;
      this.direction = 'right';
      this.shootCooldown = 0;
      this.invulnerableTime = 2.0;
      this.alive = true;
    },

    update(dt) {
      if (!this.alive) return;

      if (this.invulnerableTime > 0) {
        this.invulnerableTime -= dt;
      }

      let moveX = 0;
      let moveY = 0;

      if (keys.left) moveX -= 1;
      if (keys.right) moveX += 1;
      if (keys.up) moveY -= 1;
      if (keys.down) moveY += 1;

      if (moveX !== 0 || moveY !== 0) {
        mouse.active = false;
        const length = Math.hypot(moveX, moveY);
        this.vx = (moveX / length) * this.speed;
        this.vy = (moveY / length) * this.speed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (moveX < 0) this.direction = 'left';
        if (moveX > 0) this.direction = 'right';
      } else if (mouse.active) {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 5) {
          this.vx = dx * 10;
          this.vy = dy * 10;
          this.x += dx * 0.18;
          this.y += dy * 0.18;
          if (dx < -3) this.direction = 'left';
          else if (dx > 3) this.direction = 'right';
        } else {
          this.vx = 0;
          this.vy = 0;
        }
      } else {
        this.vx = 0;
        this.vy = 0;
      }

      this.x = Math.max(55, Math.min(CANVAS_WIDTH - 55, this.x));
      this.y = Math.max(150, Math.min(CANVAS_HEIGHT - 65, this.y));

      if (this.shootCooldown > 0) {
        this.shootCooldown -= dt;
      }

      const wantsToShoot = keys.shoot || mouse.shooting;
      if (wantsToShoot && this.shootCooldown <= 0) {
        this.shoot();
        this.shootCooldown = this.shootInterval;
      }
    },

    shoot() {
      playerSeeds.push({
        x: this.x - 12,
        y: this.y - 36,
        width: 14,
        height: 26,
        vy: -720
      });
      playerSeeds.push({
        x: this.x + 12,
        y: this.y - 36,
        width: 14,
        height: 26,
        vy: -720
      });
      sound.playShoot();
    },

    draw(ctx) {
      if (!this.alive) return;

      if (this.invulnerableTime > 0) {
        if (Math.floor(globalTime * 12) % 2 === 0) return;
      }

      ctx.save();
      ctx.translate(this.x, this.y);

      const tilt = (this.direction === 'left' ? -0.12 : 0.12) * (Math.abs(this.vx) / 300);
      ctx.rotate(tilt);

      const flap = Math.sin(globalTime * 16) * 0.05;
      ctx.scale(1 + flap, 1 - flap * 0.5);

      const sprite = this.direction === 'left' ? assets.guacamayaLeft : assets.guacamayaRight;
      if (sprite) {
        ctx.drawImage(sprite, -this.width / 2, -this.height / 2, this.width, this.height);
      }
      ctx.restore();
    }
  };

  // Semillas y Proyectiles
  let playerSeeds = [];
  let enemies = [];
  let enemySeeds = [];
  let enemySpawnTimer = 0;

  // Frutos y Contador
  let fruits = [];
  let fruitSpawnTimer = 0;
  let fruitsCollected = 0;
  let score = 0;
  let enemiesDefeated = 0;

  // Fondo en loop continuo.
  // Background.png ya es simétrico (la mitad inferior es el espejo de la superior),
  // por lo que el borde inferior coincide con el superior y se repite sin cortes.
  // Se pre-escala una sola vez a un canvas de alto ENTERO para evitar líneas
  // finas (subpíxel) entre repeticiones.
  let bgTile = null;
  let bgTileH = 0;
  let bgY = 0;
  const bgScrollSpeed = 70; // px por segundo

  function buildBackgroundTile() {
    if (bgTile || !assets.bg) return;
    const scale = CANVAS_WIDTH / assets.bg.naturalWidth;
    bgTileH = Math.round(assets.bg.naturalHeight * scale);
    bgTile = document.createElement('canvas');
    bgTile.width = CANVAS_WIDTH;
    bgTile.height = bgTileH;
    const tctx = bgTile.getContext('2d');
    tctx.imageSmoothingEnabled = true;
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(assets.bg, 0, 0, CANVAS_WIDTH, bgTileH);
  }

  // --- OLEADAS Y GENERACIÓN DE ENEMIGOS ---
  function spawnEnemy() {
    const types = ['scout', 'weaver', 'shooter'];
    const type = types[Math.floor(Math.random() * types.length)];
    const startX = 120 + Math.random() * (CANVAS_WIDTH - 240);

    enemies.push({
      x: startX,
      y: -60,
      baseX: startX,
      width: 82,
      height: 58,
      hitRadius: 26,
      type: type,
      hp: type === 'shooter' ? 3 : 2,
      maxHp: type === 'shooter' ? 3 : 2,
      vy: type === 'scout' ? 170 : 125,
      timeAlive: 0,
      shootTimer: type === 'shooter' ? 1.1 : 999,
      hitFlash: 0
    });
  }

  function spawnFruit(x, y, vy = 90) {
    fruits.push({
      x: x !== undefined ? x : 120 + Math.random() * (CANVAS_WIDTH - 240),
      y: y !== undefined ? y : -40,
      width: 42,
      height: 34,
      hitRadius: 24,
      vy: vy,
      angle: Math.random() * Math.PI,
      wobbleSpeed: 2.2 + Math.random() * 2
    });
  }

  // --- REINICIO Y ESTADOS ---
  function startGame() {
    sound.stopIntro();
    currentState = STATES.PLAYING;
    restartGame();
    sound.playBGM();
  }

  function restartGame() {
    player.reset();
    playerSeeds = [];
    enemies = [];
    enemySeeds = [];
    fruits = [];
    particles = [];
    floatTexts = [];
    fruitsCollected = 0;
    score = 0;
    enemiesDefeated = 0;
    enemySpawnTimer = 0.8;
    fruitSpawnTimer = 2.4;
    screenShake = 0;
    gameOverTimer = 0;
    currentState = STATES.PLAYING;
    sound.playBGM();
  }

  function gameOver() {
    if (!player.alive) return;
    player.alive = false;
    screenShake = 0.6;
    gameOverTimer = 0;
    createFeatherExplosion(player.x, player.y, true);
    sound.playPlayerDeath();

    setTimeout(() => {
      currentState = STATES.GAMEOVER;
    }, 450);
  }

  function triggerVictory() {
    currentState = STATES.VICTORY;
    sound.playVictory();
    enemySeeds = [];
  }

  // --- BUCLE PRINCIPAL DE ACTUALIZACIÓN ---
  function update(dt) {
    globalTime += dt;

    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - dt * 2.5);
    }

    // Scroll continuo del fondo
    if (bgTileH > 0) bgY = (bgY + bgScrollSpeed * dt) % bgTileH;

    if (currentState === STATES.PLAYING) {
      player.update(dt);

      enemySpawnTimer -= dt;
      if (enemySpawnTimer <= 0) {
        spawnEnemy();
        enemySpawnTimer = Math.max(1.0, 2.0 - (fruitsCollected * 0.08));
      }

      fruitSpawnTimer -= dt;
      if (fruitSpawnTimer <= 0) {
        spawnFruit();
        fruitSpawnTimer = 3.6 + Math.random() * 2.0;
      }

      // Semillas del jugador
      for (let i = playerSeeds.length - 1; i >= 0; i--) {
        const s = playerSeeds[i];
        s.y += s.vy * dt;
        if (s.y < -40) {
          playerSeeds.splice(i, 1);
        }
      }

      // Enemigos
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.timeAlive += dt;
        e.y += e.vy * dt;

        if (e.hitFlash > 0) e.hitFlash -= dt;

        if (e.type === 'weaver') {
          e.x = e.baseX + Math.sin(e.timeAlive * 3.2) * 110;
        } else if (e.type === 'shooter') {
          if (e.y > 180 && e.y < 340) {
            e.vy = 50;
          } else {
            e.vy = 150;
          }

          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && e.y < CANVAS_HEIGHT - 180) {
            const angle = Math.atan2(player.y - e.y, player.x - e.x);
            const speed = 290;
            enemySeeds.push({
              x: e.x,
              y: e.y + 24,
              width: 14,
              height: 24,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed
            });
            sound.playEnemyShoot();
            e.shootTimer = 1.9;
          }
        }

        // Colisión entre Guacamaya y ave enemiga
        if (player.alive && player.invulnerableTime <= 0) {
          const dist = Math.hypot(player.x - e.x, player.y - e.y);
          if (dist < player.hitRadius + e.hitRadius) {
            gameOver();
            return;
          }
        }

        // Impactos de semillas del jugador sobre el enemigo
        for (let j = playerSeeds.length - 1; j >= 0; j--) {
          const s = playerSeeds[j];
          const dist = Math.hypot(s.x - e.x, s.y - e.y);
          if (dist < e.hitRadius + 12) {
            playerSeeds.splice(j, 1);
            e.hp--;
            e.hitFlash = 0.12;
            sound.playHit();

            if (e.hp <= 0) {
              createFeatherExplosion(e.x, e.y, false);
              sound.playExplosion();
              score += 100;
              enemiesDefeated++;
              addFloatText(e.x, e.y - 10, '+100', '#ffd700');

              if (Math.random() < 0.45 && fruitsCollected < TARGET_FRUITS) {
                spawnFruit(e.x, e.y, 65);
              }

              enemies.splice(i, 1);
              break;
            }
          }
        }

        if (e.y > CANVAS_HEIGHT + 70) {
          enemies.splice(i, 1);
        }
      }

      // Semillas enemigas
      for (let i = enemySeeds.length - 1; i >= 0; i--) {
        const es = enemySeeds[i];
        es.x += es.vx * dt;
        es.y += es.vy * dt;

        if (player.alive && player.invulnerableTime <= 0) {
          const dist = Math.hypot(player.x - es.x, player.y - es.y);
          if (dist < player.hitRadius + 8) {
            enemySeeds.splice(i, 1);
            gameOver();
            return;
          }
        }

        if (es.y > CANVAS_HEIGHT + 40 || es.y < -40 || es.x < -40 || es.x > CANVAS_WIDTH + 40) {
          enemySeeds.splice(i, 1);
        }
      }

      // Frutos (Sandías)
      for (let i = fruits.length - 1; i >= 0; i--) {
        const f = fruits[i];
        f.y += f.vy * dt;
        f.angle += f.wobbleSpeed * dt;
        f.x += Math.sin(f.angle) * 0.9;

        const dist = Math.hypot(player.x - f.x, player.y - f.y);
        if (dist < 130) {
          f.x += (player.x - f.x) * 4.8 * dt;
          f.y += (player.y - f.y) * 4.8 * dt;
        }

        if (dist < player.hitRadius + f.hitRadius) {
          fruits.splice(i, 1);
          fruitsCollected++;
          score += 250;
          sound.playFruit();
          createFruitSparkles(f.x, f.y);
          addFloatText(f.x, f.y - 15, `+1 FRUTA (${fruitsCollected}/10)`, '#67ff9b');

          if (fruitsCollected >= TARGET_FRUITS) {
            triggerVictory();
          }
          continue;
        }

        if (f.y > CANVAS_HEIGHT + 50) {
          fruits.splice(i, 1);
        }
      }
    } else if (currentState === STATES.GAMEOVER) {
      gameOverTimer += dt;
    } else if (currentState === STATES.VICTORY) {
      player.y -= 260 * dt;
      if (Math.random() < 0.35) {
        createFruitSparkles(
          Math.random() * CANVAS_WIDTH,
          Math.random() * CANVAS_HEIGHT * 0.7
        );
      }
    }

    // Partículas
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Textos flotantes
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const ft = floatTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) {
        floatTexts.splice(i, 1);
      }
    }
  }

  // --- RENDERIZADO VISUAL ---
  function render() {
    ctx.save();

    if (screenShake > 0) {
      const shakeAmt = screenShake * 18;
      ctx.translate(
        (Math.random() - 0.5) * shakeAmt,
        (Math.random() - 0.5) * shakeAmt
      );
    }

    // 1. DIBUJAR FONDO CON LOOP PERFECTO
    renderBackgroundLoop();

    // 3. PANTALLAS SEGÚN EL ESTADO
    if (currentState === STATES.LOADING) {
      renderLoading();
    } else if (currentState === STATES.TITLE) {
      renderTitle();
    } else {
      renderGameWorld();
      renderHeadAndCounter();

      if (currentState === STATES.GAMEOVER) {
        renderGameOver();
      } else if (currentState === STATES.VICTORY) {
        renderVictory();
      }
    }

    ctx.restore();
  }

  function renderBackgroundLoop() {
    if (!assets.bg) {
      ctx.fillStyle = '#0d2417';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      return;
    }

    buildBackgroundTile();

    // El fondo se mueve hacia abajo: se dibujan dos copias consecutivas
    // en posiciones enteras (la 2ª queda justo encima de la 1ª).
    const y1 = Math.floor(bgY);
    ctx.drawImage(bgTile, 0, y1);
    ctx.drawImage(bgTile, 0, y1 - bgTileH);
  }

  function renderLoading() {
    ctx.fillStyle = 'rgba(5, 15, 10, 0.88)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#79f29d';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CARGANDO XCARET BATTLES...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 25);

    const barW = 380;
    const barH = 18;
    const progress = loadedAssets / assetList.length;

    ctx.strokeStyle = '#79f29d';
    ctx.lineWidth = 2;
    ctx.strokeRect((CANVAS_WIDTH - barW) / 2, CANVAS_HEIGHT / 2 + 10, barW, barH);

    ctx.fillStyle = '#256d3e';
    ctx.fillRect((CANVAS_WIDTH - barW) / 2 + 2, CANVAS_HEIGHT / 2 + 12, (barW - 4) * progress, barH - 4);
  }

  function renderTitle() {
    if (titleVideo.ready()) {
      titleVideo.draw();
    } else if (assets.pres) {
      // Respaldo mientras carga el video (o si no existe)
      ctx.drawImage(assets.pres, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const grad = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.65, 0, CANVAS_HEIGHT);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(4, 14, 9, 0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, CANVAS_HEIGHT * 0.65, CANVAS_WIDTH, CANVAS_HEIGHT * 0.35);

    if (assets.pressStart) {
      const btnW = 250;
      const btnH = 55;
      const pulse = Math.sin(globalTime * 5) * 0.05;
      const curW = btnW * (1 + pulse);
      const curH = btnH * (1 + pulse);
      const btnX = (CANVAS_WIDTH - curW) / 2;
      const btnY = CANVAS_HEIGHT - 135;

      ctx.save();
      ctx.shadowColor = '#4eaf72';
      ctx.shadowBlur = 18;
      ctx.drawImage(assets.pressStart, btnX, btnY, curW, curH);
      ctx.restore();
    }
  }

  function renderGameWorld() {
    // 1. Frutos (Sandías)
    fruits.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(Math.sin(f.angle) * 0.15);

      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      if (assets.fruit) {
        ctx.drawImage(assets.fruit, -f.width / 2, -f.height / 2, f.width, f.height);
      }
      ctx.restore();
    });

    // 2. Semillas del jugador
    playerSeeds.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.shadowColor = '#ffd000';
      ctx.shadowBlur = 10;

      if (assets.seed) {
        ctx.drawImage(assets.seed, -s.width / 2, -s.height / 2, s.width, s.height);
      } else {
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(-s.width / 2, -s.height / 2, s.width, s.height);
      }
      ctx.restore();
    });

    // 3. Aves enemigas (GIRADAS DE CABEZA - PICANDO HACIA ABAJO)
    enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);

      // Inclinación aerodinámica según movimiento
      const bankAngle = (e.type === 'weaver') ? Math.cos(e.timeAlive * 3.2) * 0.15 : 0;

      // Rotación 180° para que vuele de cabeza hacia abajo hacia el jugador
      ctx.rotate(Math.PI + bankAngle);

      const flap = Math.sin(globalTime * 14 + e.timeAlive) * 0.05;
      ctx.scale(1 + flap, 1 - flap * 0.5);

      if (e.hitFlash > 0) {
        ctx.filter = 'brightness(2.5)';
      }

      if (assets.enemy) {
        ctx.drawImage(assets.enemy, -e.width / 2, -e.height / 2, e.width, e.height);
      }
      ctx.restore();

      // Barra de vida (dibujada al derecho arriba del enemigo)
      if (e.maxHp > 1) {
        ctx.save();
        const hpBarW = 40;
        const hpBarH = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - hpBarW / 2, e.y - e.height / 2 - 10, hpBarW, hpBarH);
        ctx.fillStyle = e.hp === 1 ? '#ff3b30' : '#4cd964';
        ctx.fillRect(e.x - hpBarW / 2, e.y - e.height / 2 - 10, hpBarW * (e.hp / e.maxHp), hpBarH);
        ctx.restore();
      }
    });

    // 4. Semillas enemigas
    enemySeeds.forEach(es => {
      ctx.save();
      ctx.translate(es.x, es.y);
      const angle = Math.atan2(es.vy, es.vx) - Math.PI / 2;
      ctx.rotate(angle);

      ctx.shadowColor = '#ff2a2a';
      ctx.shadowBlur = 12;

      if (assets.seed) {
        ctx.filter = 'hue-rotate(180deg) saturate(2.5)';
        ctx.drawImage(assets.seed, -es.width / 2, -es.height / 2, es.width, es.height);
      }
      ctx.restore();
    });

    // 5. Jugador (Guacamaya)
    player.draw(ctx);

    // 6. Partículas
    particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
      ctx.restore();
    });

    // 7. Textos flotantes
    floatTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 15px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }

  // --- MARCO SUPERIOR ACTUALIZADO: HEAD AND COUNTER ---
  function renderHeadAndCounter() {
    if (!assets.headCounter) return;

    ctx.save();
    const frameW = 1240;
    const frameH = 148;
    const frameX = (CANVAS_WIDTH - frameW) / 2;
    const frameY = 0;

    // Resplandor dorado de la corona
    ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.drawImage(assets.headCounter, frameX, frameY, frameW, frameH);
    ctx.restore();

    const scale = frameW / 1266;

    // 1. RANURA IZQUIERDA: MARCADOR DE PUNTOS
    const scoreCenterX = frameX + (135 * scale);
    const scoreCenterY = frameY + (78 * scale);

    ctx.save();
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffea79';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`PTS ${score.toString().padStart(6, '0')}`, scoreCenterX, scoreCenterY + 4);
    ctx.restore();

    // 2. RANURA DERECHA: CONTADOR DE SANDÍAS
    const counterCenterX = frameX + (1088 * scale);
    const counterCenterY = frameY + (78 * scale);

    ctx.save();
    ctx.font = '800 18px "Fredoka", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${fruitsCollected} / ${TARGET_FRUITS}`, counterCenterX, counterCenterY + 4);

    // Mini barra de progreso bajo el conteo
    const pBarW = 54;
    const pBarH = 4;
    const progress = Math.min(1, fruitsCollected / TARGET_FRUITS);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(counterCenterX - pBarW / 2, counterCenterY + 9, pBarW, pBarH);
    ctx.fillStyle = progress >= 1 ? '#ffeb3b' : '#00e676';
    ctx.fillRect(counterCenterX - pBarW / 2, counterCenterY + 9, pBarW * progress, pBarH);
    ctx.restore();
  }

  // --- PANTALLA GAMEOVER CON EL ELEMENTO ACTUALIZADO GameOver.png ---
  // Dibuja una imagen centrada en (cx, cy) ajustada a maxW x maxH sin deformarla
  function drawContained(img, cx, cy, maxW, maxH, scaleMul = 1) {
    const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight) * scaleMul;
    const w = img.naturalWidth * k;
    const h = img.naturalHeight * k;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    return { w, h };
  }

  function renderGameOver() {
    ctx.save();
    ctx.fillStyle = 'rgba(6, 10, 8, 0.88)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const animScale = Math.min(1.0, 0.5 + gameOverTimer * 2.2);

    if (assets.gameover) {
      const gW = 640 * animScale;
      const gH = 274 * animScale;
      const gX = (CANVAS_WIDTH - gW) / 2;
      const gY = 110 + (1 - animScale) * 30;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 60, 40, 0.6)';
      ctx.shadowBlur = 24;
      ctx.drawImage(assets.gameover, gX, gY, gW, gH);
      ctx.restore();
    }

    const cardY = 410;
    ctx.textAlign = 'center';

    if (assets.ventana) {
      // Ventana.png reemplaza el rectángulo; el texto se centra sobre ella
      const cy = cardY + 80;
      const win = drawContained(assets.ventana, CANVAS_WIDTH / 2, cy, 560, 200);
      let f = Math.min(1, win.h / 200);            // reduce la letra si la ventana es baja
      ctx.font = '18px "Fredoka", sans-serif';
      const headW = ctx.measureText('¡La Guacamaya chocó con un ave enemiga!').width;
      f = Math.min(f, (win.w * 0.82) / headW);     // y si la ventana es angosta

      // Bloque de texto compacto, centrado en la ventana
      const headY = cy - 38 * f;       // título
      const line1 = headY + 34 * f;    // sandías
      const lineH = 26 * f;            // separación entre renglones
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 4;
      ctx.font = `${Math.max(12, Math.round(18 * f))}px "Fredoka", sans-serif`;
      ctx.fillStyle = '#ff8080';
      ctx.fillText('¡La Guacamaya chocó con un ave enemiga!', CANVAS_WIDTH / 2, headY);
      ctx.font = `${Math.max(11, Math.round(16 * f))}px "Fredoka", sans-serif`;
      ctx.fillStyle = '#f0f7f2';
      ctx.fillText(`🍉 Sandías recolectadas: ${fruitsCollected} / ${TARGET_FRUITS}`, CANVAS_WIDTH / 2, line1);
      ctx.fillText(`🎯 Aves enemigas vencidas: ${enemiesDefeated}`, CANVAS_WIDTH / 2, line1 + lineH);
      ctx.fillText(`⭐ Puntuación final: ${score}`, CANVAS_WIDTH / 2, line1 + lineH * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(16, 32, 22, 0.92)';
      ctx.strokeStyle = 'rgba(255, 120, 80, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(CANVAS_WIDTH / 2 - 240, cardY, 480, 160, 16);
      ctx.fill();
      ctx.stroke();

      ctx.font = '18px "Fredoka", sans-serif';
      ctx.fillStyle = '#ff8080';
      ctx.fillText('¡La Guacamaya chocó con un ave enemiga!', CANVAS_WIDTH / 2, cardY + 38);

      ctx.font = '16px "Fredoka", sans-serif';
      ctx.fillStyle = '#f0f7f2';
      ctx.fillText(`🍉 Sandías recolectadas: ${fruitsCollected} / ${TARGET_FRUITS}`, CANVAS_WIDTH / 2, cardY + 76);
      ctx.fillText(`🎯 Aves enemigas vencidas: ${enemiesDefeated}`, CANVAS_WIDTH / 2, cardY + 106);
      ctx.fillText(`⭐ Puntuación final: ${score}`, CANVAS_WIDTH / 2, cardY + 136);
    }

    const pulse = Math.sin(globalTime * 6) * 0.05;
    if (assets.retry) {
      // Botón Reintentar.png (397x89) con ligera pulsación
      const btnW = 260 * (1 + pulse);
      const btnH = btnW * (assets.retry.naturalHeight / assets.retry.naturalWidth);
      const btnX = (CANVAS_WIDTH - btnW) / 2;
      const btnY = CANVAS_HEIGHT - 75 - btnH / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 140, 60, 0.7)';
      ctx.shadowBlur = 18;
      ctx.drawImage(assets.retry, btnX, btnY, btnW, btnH);
      ctx.restore();
    } else {
      ctx.font = `${Math.floor(16 * (1 + pulse))}px "Fredoka", sans-serif`;
      ctx.fillStyle = '#ffea79';
      ctx.fillText('Presiona ESPACIO o haz CLIC para Reintentar', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80);
    }
    ctx.restore();
  }

  function renderVictory() {
    ctx.fillStyle = 'rgba(6, 30, 16, 0.88)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.textAlign = 'center';
    if (assets.winner) {
      // Winner.png reemplaza los textos "¡NIVEL COMPLETADO!" y "¡MISIÓN CUMPLIDA EN XCARET!"
      const bob = Math.sin(globalTime * 2.5) * 4; // leve flotación
      ctx.save();
      ctx.shadowColor = 'rgba(255, 225, 0, 0.55)';
      ctx.shadowBlur = 22;
      drawContained(assets.winner, CANVAS_WIDTH / 2, 160 + bob, 640, 200);
      ctx.restore();
    } else {
      ctx.font = '24px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffeb3b';
      ctx.shadowColor = '#ffe100';
      ctx.shadowBlur = 18;
      ctx.fillText('¡NIVEL COMPLETADO!', CANVAS_WIDTH / 2, 190);

      ctx.font = '26px "Fredoka", sans-serif';
      ctx.fillStyle = '#79f29d';
      ctx.shadowBlur = 0;
      ctx.fillText('¡MISIÓN CUMPLIDA EN XCARET!', CANVAS_WIDTH / 2, 240);
    }

    const cardY = 285;
    ctx.fillStyle = 'rgba(15, 45, 25, 0.92)';
    ctx.strokeStyle = '#4eaf72';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(CANVAS_WIDTH / 2 - 240, cardY, 480, 220, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = '17px "Fredoka", sans-serif';
    ctx.fillStyle = '#e8fbf0';
    ctx.fillText('¡Has recolectado las 10 sandías y protegido la selva!', CANVAS_WIDTH / 2, cardY + 45);

    ctx.font = '19px "Fredoka", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`🍉 Sandías totales: 10 / 10`, CANVAS_WIDTH / 2, cardY + 95);
    ctx.fillText(`🎯 Aves enemigas derrotadas: ${enemiesDefeated}`, CANVAS_WIDTH / 2, cardY + 130);
    ctx.font = 'bold 22px "Fredoka", sans-serif';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`⭐ Puntuación Total: ${score + 1000} PTS`, CANVAS_WIDTH / 2, cardY + 175);

    const pulse = Math.sin(globalTime * 5) * 0.08;
    ctx.font = `${Math.floor(17 * (1 + pulse))}px "Fredoka", sans-serif`;
    ctx.fillStyle = '#ffea79';
    ctx.fillText('Presiona ESPACIO o haz CLIC para Jugar de Nuevo', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 120);
    ctx.restore();
  }

  // --- BUCLE DE ANIMACIÓN PRINCIPAL ---
  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) sound.pauseForBackground();
    else sound.resumeFromBackground();
  });

  loadAssets(() => {
    currentState = STATES.TITLE;
    titleVideo.play();
    sound.playIntro();
  });

  requestAnimationFrame(gameLoop);
})();
