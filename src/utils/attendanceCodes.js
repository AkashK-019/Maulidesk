export const SHIFT_CODES = [
  { code: 'A',    label: 'Absent',            multiplier: 0,   tone: 'absent' },
  { code: '1/2',  label: 'Half Day',          multiplier: 0.5, tone: 'half' },
  { code: 'P',    label: 'Present',           multiplier: 1,   tone: 'present' },
  { code: 'P1/2', label: "Up to 9 O'Clock",   multiplier: 1.5, tone: 'onehalf' },
  { code: 'PP',   label: "Up to 12 O'Clock",  multiplier: 2,   tone: 'double' },
  { code: 'PPP',  label: "Up to 4 O'Clock",   multiplier: 3,   tone: 'triple' },
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