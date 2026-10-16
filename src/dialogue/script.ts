/**
 * The film's dialogue, timed per scene (local seconds).
 * Speakers follow British/Scottish military radio discipline — terse,
 * procedural, unhurried until the point where procedure stops helping.
 */

export type Speaker = 'CONTROL' | 'OPERATOR 1' | 'OPERATOR 2' | 'SCOTTISH OPERATIONS' | 'TECHNICIAN' | 'RADIO' | 'WHISPER';

export interface Line {
  time: number;
  duration: number;
  speaker: Speaker;
  text: string;
  /** Delivered over a radio channel (adds squelch + hiss). */
  radio?: boolean;
  /** Spoken quietly. */
  quiet?: boolean;
}

export const SPEAKER_COLOURS: Record<Speaker, string> = {
  CONTROL: '#d9a441',
  'OPERATOR 1': '#7fe08a',
  'OPERATOR 2': '#7fb6e0',
  'SCOTTISH OPERATIONS': '#e07a6a',
  TECHNICIAN: '#b9c2b5',
  RADIO: '#e07a6a',
  WHISPER: '#9aa39c',
};

export const SCRIPT: Record<string, Line[]> = {
  control: [
    { time: 8.2, duration: 3.1, speaker: 'OPERATOR 1', text: 'Control, Glasgow West has flagged another movement event.' },
    { time: 11.6, duration: 1.5, speaker: 'CONTROL', text: 'Which camera?' },
    { time: 13.3, duration: 2.0, speaker: 'OPERATOR 1', text: 'Riverside. Camera twelve.' },
    { time: 15.5, duration: 1.5, speaker: 'CONTROL', text: 'Another mutant?' },
    { time: 17.2, duration: 1.2, speaker: 'OPERATOR 1', text: 'Possibly.' },
    { time: 18.8, duration: 2.4, speaker: 'OPERATOR 2', text: "Christ. What's left down there to eat?" },
  ],
  surface: [
    { time: 9.0, duration: 1.3, speaker: 'CONTROL', text: 'Magnify.' },
    { time: 12.6, duration: 1.6, speaker: 'OPERATOR 1', text: 'Target acquired.' },
    { time: 14.4, duration: 1.5, speaker: 'CONTROL', text: 'Classification?' },
    { time: 16.0, duration: 1.3, speaker: 'OPERATOR 1', text: 'Unknown.' },
    { time: 17.6, duration: 2.6, speaker: 'OPERATOR 2', text: 'Could be one of the larger surface variants.' },
    { time: 20.4, duration: 1.8, speaker: 'OPERATOR 1', text: 'Not moving like one.' },
    { time: 26.0, duration: 2.0, speaker: 'OPERATOR 1', text: '...What the fuck is that?' },
  ],
  entity: [
    { time: 2.0, duration: 1.5, speaker: 'CONTROL', text: 'Height estimate?' },
    { time: 3.8, duration: 2.1, speaker: 'OPERATOR 1', text: 'Four metres. Maybe more.' },
    { time: 6.2, duration: 2.4, speaker: 'CONTROL', text: 'Any match in the biological catalogue?' },
    { time: 8.8, duration: 2.4, speaker: 'OPERATOR 2', text: 'Negative. Nothing remotely close.' },
    { time: 15.2, duration: 1.8, speaker: 'CONTROL', text: 'Is it looking at us?' },
    { time: 17.2, duration: 2.6, speaker: 'OPERATOR 1', text: "Camera's passive. No active illumination." },
  ],
  network: [
    { time: 0.6, duration: 4.2, speaker: 'CONTROL', text: 'Put Glasgow sector on the joint network. I want every available camera covering the river.' },
    { time: 5.2, duration: 2.8, speaker: 'SCOTTISH OPERATIONS', text: 'Receiving. Glasgow municipal feeds are coming online.', radio: true },
    { time: 13.6, duration: 1.6, speaker: 'OPERATOR 2', text: "That's not possible." },
    { time: 15.4, duration: 1.8, speaker: 'CONTROL', text: 'Could there be more than one?' },
    { time: 17.4, duration: 2.4, speaker: 'OPERATOR 1', text: 'Same dimensions. Same thermal signature.' },
    { time: 20.0, duration: 3.2, speaker: 'SCOTTISH OPERATIONS', text: "Control, we're receiving identical detections from three other sectors.", radio: true },
    { time: 23.4, duration: 1.2, speaker: 'CONTROL', text: 'Which sectors?' },
    { time: 24.8, duration: 3.4, speaker: 'SCOTTISH OPERATIONS', text: 'Edinburgh. Central Belt. And one of the Faslane perimeter cameras.', radio: true },
    { time: 29.0, duration: 2.0, speaker: 'CONTROL', text: "Tell me that's a network fault." },
    { time: 31.2, duration: 1.6, speaker: 'TECHNICIAN', text: 'No fault showing, sir.' },
    { time: 34.0, duration: 2.8, speaker: 'OPERATOR 1', text: "Control... something's accessing the internal network." },
  ],
  inside: [
    { time: 1.6, duration: 1.6, speaker: 'CONTROL', text: 'Disconnect the external feeds.' },
    { time: 3.4, duration: 1.3, speaker: 'OPERATOR 2', text: 'Already doing it.' },
    { time: 4.9, duration: 1.9, speaker: 'CONTROL', text: 'Then why are they still running?' },
    { time: 12.2, duration: 1.7, speaker: 'OPERATOR 1', text: "That's an internal camera." },
    { time: 14.1, duration: 1.2, speaker: 'CONTROL', text: 'Which facility?' },
    { time: 15.9, duration: 1.6, speaker: 'OPERATOR 1', text: '...Ours.' },
    { time: 21.2, duration: 2.3, speaker: 'WHISPER', text: 'How did it get through the perimeter?', quiet: true },
    { time: 29.8, duration: 2.3, speaker: 'RADIO', text: 'Scotland Control... are you receiving?', radio: true },
    { time: 33.0, duration: 1.9, speaker: 'RADIO', text: 'Scotland Control, respond.', radio: true },
  ],
  title: [],
  end: [],
};

export function activeLine(lines: readonly Line[], t: number): Line | undefined {
  for (const l of lines) if (t >= l.time && t < l.time + l.duration) return l;
  return undefined;
}
