import { Haptics } from '@capacitor/haptics'

let audio: AudioContext | undefined

function beep() {
  audio ??= new AudioContext()
  const t = audio.currentTime
  for (let i = 0; i < 3; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.frequency.value = i === 2 ? 1320 : 880
    gain.gain.setValueAtTime(0.25, t + i * 0.25)
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.25 + 0.18)
    osc.connect(gain).connect(audio.destination)
    osc.start(t + i * 0.25)
    osc.stop(t + i * 0.25 + 0.2)
  }
}

export async function restFinishedAlert(sound: boolean) {
  if (sound) {
    try {
      beep()
    } catch {
      // Audio can be unavailable (e.g. no user gesture yet); vibration still fires.
    }
  }
  try {
    await Haptics.vibrate({ duration: 700 })
  } catch {
    navigator.vibrate?.(700)
  }
}
