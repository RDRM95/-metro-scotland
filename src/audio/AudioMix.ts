/**
 * Continuous ambience levels (0..1) a scene requests at a given moment.
 * The AudioEngine slews its bus gains towards these values each frame, so
 * seeking lands on the correct soundscape without clicks.
 */
export interface AudioMix {
  bunker: number; // ventilation, equipment hum, fans
  rain: number; // surface rainfall
  wind: number;
  river: number;
  radio: number; // open radio channel hiss
  drone: number; // low horror tone
  sub: number; // sub-bass pressure
  alarm: number; // slow repeating alert tone
  emergency: number; // emergency-lighting buzz
  static: number; // CCTV interference crackle
}

export const SILENCE: AudioMix = {
  bunker: 0, rain: 0, wind: 0, river: 0, radio: 0, drone: 0, sub: 0, alarm: 0, emergency: 0, static: 0,
};

export function mix(partial: Partial<AudioMix>): AudioMix {
  return { ...SILENCE, ...partial };
}
