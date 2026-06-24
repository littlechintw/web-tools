<script setup lang="ts">
import { ref } from 'vue'

const isOn = ref(false)

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new Ctor()
  }
  return audioCtx
}

function playClick(on: boolean) {
  try {
    const ctx = getCtx()
    // Two-layer click: sharp transient + body thud
    const dur = 0.055
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      const t = i / ctx.sampleRate
      const freq = on ? 2400 : 900
      d[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * 120) * 0.6
             + (Math.random() * 2 - 1) * Math.exp(-t * 200) * 0.25
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const gain = ctx.createGain()
    gain.gain.value = 1
    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
  } catch { /* silent */ }
}

function toggle() {
  isOn.value = !isOn.value
  playClick(isOn.value)
}
</script>

<template>
  <div class="scene">
    <div class="panel" :class="{ 'panel--on': isOn }">

      <!-- Status LED strip -->
      <div class="led-row">
        <div class="led" :class="{ 'led--on': isOn }" />
        <span class="led-label">{{ isOn ? 'ON' : 'OFF' }}</span>
      </div>

      <!-- The switch -->
      <button
        class="switch-btn"
        :class="{ 'switch-btn--on': isOn }"
        :aria-pressed="isOn"
        aria-label="toggle switch"
        @click="toggle"
      >
        <!-- Housing groove -->
        <div class="switch-track">
          <!-- Lever knob -->
          <div class="switch-knob" />
        </div>
      </button>

      <!-- ON / OFF markers -->
      <div class="markers">
        <span :class="{ 'marker--active': isOn }">ON</span>
        <span :class="{ 'marker--active': !isOn }">OFF</span>
      </div>

    </div>
  </div>
</template>

<style scoped>
.scene {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

/* ── Panel ── */
.panel {
  background: linear-gradient(160deg, #1e2230 0%, #141720 100%);
  border: 2px solid #2e3448;
  border-radius: 24px;
  padding: 2.5rem 3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rem;
  box-shadow:
    0 0 0 1px #0a0c12,
    0 12px 48px rgba(0,0,0,.7),
    inset 0 1px 0 #ffffff0c;
  transition: box-shadow 0.35s ease;
  min-width: 240px;
}

.panel--on {
  box-shadow:
    0 0 0 1px #0a0c12,
    0 12px 48px rgba(0,0,0,.7),
    0 0 60px rgba(80,200,120,.18),
    inset 0 1px 0 #ffffff0c;
}

/* ── LED row ── */
.led-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.led {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #1a2020;
  border: 2px solid #2a3a30;
  transition: background 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.led--on {
  background: #50e898;
  border-color: #70ffb0;
  box-shadow: 0 0 8px #50e898, 0 0 20px #50e89866;
}

.led-label {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: #3a4a40;
  transition: color 0.2s, text-shadow 0.2s;
}

.panel--on .led-label {
  color: #50e898;
  text-shadow: 0 0 12px #50e89888;
}

/* ── Switch button ── */
.switch-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  outline: none;
}

.switch-btn:focus-visible .switch-track {
  box-shadow:
    0 0 0 3px #ffffff33,
    inset 0 4px 12px #00000080;
}

/* ── Track (housing) ── */
.switch-track {
  width: 100px;
  height: 180px;
  background: linear-gradient(180deg, #0e1018 0%, #1a1e28 60%, #0e1018 100%);
  border-radius: 50px;
  border: 3px solid #2a2e3e;
  box-shadow:
    inset 0 4px 12px #00000080,
    inset 0 -2px 8px #ffffff06,
    0 2px 8px #00000060;
  position: relative;
  transition: border-color 0.25s;
}

.switch-btn--on .switch-track {
  border-color: #3a6a50;
}

/* ── Knob ── */
.switch-knob {
  position: absolute;
  left: 50%;
  width: 72px;
  height: 78px;
  border-radius: 36px;
  transform: translateX(-50%);
  background: linear-gradient(160deg, #d0d4e0 0%, #90959e 50%, #70757e 100%);
  border: 2px solid #bbbfc8;
  box-shadow:
    0 4px 16px #00000090,
    0 1px 0 #ffffff40,
    inset 0 2px 4px #ffffff30,
    inset 0 -2px 4px #00000040;
  transition:
    top 0.18s cubic-bezier(0.34, 1.45, 0.64, 1),
    background 0.2s,
    border-color 0.2s,
    box-shadow 0.2s;

  /* OFF: knob at bottom */
  top: calc(100% - 82px);
}

/* Knob ridge lines */
.switch-knob::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 44px;
  height: 3px;
  border-radius: 2px;
  background: rgba(0,0,0,.25);
  box-shadow: 0 -7px 0 rgba(0,0,0,.18), 0 7px 0 rgba(0,0,0,.18);
}

.switch-btn--on .switch-knob {
  /* ON: knob at top */
  top: 4px;
  background: linear-gradient(160deg, #e8f8ee 0%, #b0d8be 50%, #88b898 100%);
  border-color: #a0d0b0;
  box-shadow:
    0 4px 16px #00000090,
    0 0 20px rgba(80,200,120,.35),
    0 1px 0 #ffffff60,
    inset 0 2px 4px #ffffff40,
    inset 0 -2px 4px #00000030;
}

/* ── Active press effect ── */
.switch-btn:active .switch-track {
  box-shadow:
    inset 0 6px 16px #00000090,
    inset 0 -2px 8px #ffffff04;
}

/* ── ON / OFF markers ── */
.markers {
  display: flex;
  gap: 2rem;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.markers span {
  color: #2e3448;
  transition: color 0.2s, text-shadow 0.2s;
}

.marker--active {
  color: #c0c8dc !important;
  text-shadow: 0 0 10px #c0c8dc88;
}
</style>
