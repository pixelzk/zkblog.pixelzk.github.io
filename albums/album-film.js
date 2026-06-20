(function () {
  'use strict';
  var video = document.getElementById('albumBgVideo');
  var sound = document.getElementById('soundBtn');
  var soundGate = document.getElementById('soundGate');
  if (!video) return;

  var hlsUrl = video.getAttribute('data-hls');

  function setSound(on, blocked) {
    if (!sound) return;
    sound.textContent = blocked ? 'TAP SOUND' : (on ? 'SOUND ON' : 'SOUND OFF');
    sound.classList.toggle('is-on', !!on && !blocked);
  }
  function setSoundGate(show) {
    if (soundGate) soundGate.classList.toggle('show', !!show);
  }
  async function playMuted() {
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    try { await video.play(); } catch (e) {}
  }
  async function soundOn() {
    video.muted = false;
    video.defaultMuted = false;
    video.removeAttribute('muted');
    video.volume = 1;
    try {
      if (video.paused) await video.play();
      setSound(true, false);
      setSoundGate(false);
      return true;
    } catch (e) {
      await playMuted();
      setSound(false, true);
      setSoundGate(true);
      return false;
    }
  }
  async function toggleSound() {
    if (video.muted || video.volume === 0) await soundOn();
    else {
      await playMuted();
      setSound(false, false);
      setSoundGate(true);
    }
  }
  function init() {
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = hlsUrl;
      video.play().catch(function () {});
    } else if (window.Hls && window.Hls.isSupported()) {
      var hls = new Hls({ enableWorker:true });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, function () { video.play().catch(function () {}); });
    } else {
      video.src = hlsUrl;
      video.play().catch(function () {});
    }
    setSound(false, false);
    setSoundGate(true);
  }

  init();
  if (sound) sound.addEventListener('click', function (event) { event.preventDefault(); toggleSound(); });
  if (soundGate) soundGate.addEventListener('click', function (event) { event.preventDefault(); soundOn(); });
  ['click','touchstart','pointerdown','keydown'].forEach(function (eventName) {
    document.addEventListener(eventName, function () { soundOn(); }, { once:true, passive:true });
  });
}());
