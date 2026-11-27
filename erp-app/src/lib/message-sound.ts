import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

function getPlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    player = createAudioPlayer(require('../../assets/sounds/message.wav'));
    player.volume = 1;
    return player;
  } catch {
    return null;
  }
}

/** Plays the short incoming-message chime. Safe to call outside React. */
export function playMessageSound(): void {
  try {
    const p = getPlayer();
    if (!p) return;
    void p.seekTo(0).catch(() => {}).then(() => {
      p.play();
    });
  } catch {
    // Sound is non-critical; never block chat on it.
  }
}
