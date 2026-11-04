/** Seconds as a short phrase: 45 s, 12 min, 3.5 h (the same shape `npm run network:health` prints). */
export const ageText = (sec: number): string => (sec < 90 ? `${sec} s` : sec < 5400 ? `${Math.round(sec / 60)} min` : `${(sec / 3600).toFixed(1)} h`);
