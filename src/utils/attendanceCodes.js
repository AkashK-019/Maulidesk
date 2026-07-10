export const SHIFT_CODES = [
  { code: 'A',  label: 'Absent',        multiplier: 0,   tone: 'absent' },
  { code: '½P', label: 'Half Day',      multiplier: 0.5, tone: 'half' },
  { code: 'P',  label: '1 Shift',       multiplier: 1,   tone: 'present' },
  { code: '2P', label: '2 Shifts',      multiplier: 2,   tone: 'double' },
  { code: '3P', label: '3 Shifts',      multiplier: 3,   tone: 'triple' },
];

export const getShiftMultiplier = (code) => {
  const found = SHIFT_CODES.find(s => s.code === code);
  return found ? found.multiplier : 0;
};

export const getShiftLabel = (code) => {
  const found = SHIFT_CODES.find(s => s.code === code);
  return found ? found.label : code;
};

export const getShiftTone = (code) => {
  const found = SHIFT_CODES.find(s => s.code === code);
  return found ? found.tone : 'absent';
};