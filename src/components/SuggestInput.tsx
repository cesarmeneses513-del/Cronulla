import React, { useState } from 'react';

interface SuggestInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  className?: string;
  // Colours of the list: light for forms, dark for the photo viewer.
  dark?: boolean;
}

// Text field with a suggestion list drawn by the app. Replaces <datalist>, whose list is drawn by
// the browser and comes out unreadable (white on white) on computers in dark mode.
export const SuggestInput: React.FC<SuggestInputProps> = ({ value, onChange, options, className, dark = false }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const q = value.trim().toLowerCase();
  // A value already picked from the list shows every option again, so it can be changed.
  const exact = options.some(o => o.toLowerCase() === q);
  const shown = !q || exact ? options : options.filter(o => o.toLowerCase().includes(q));
  const visible = open && shown.length > 0;

  const pick = (option: string) => {
    onChange(option);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(a => (shown.length === 0 ? -1 : (a + step + shown.length) % shown.length));
    } else if (e.key === 'Enter' && visible && active >= 0) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape' && visible) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        className={className}
      />
      {visible && (
        <ul
          className={`absolute z-50 start-0 end-0 top-full mt-1 max-h-60 overflow-y-auto rounded-lg border shadow-xl py-1 text-sm ${
            dark ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}
        >
          {shown.map((option, i) => (
            <li
              key={option}
              // mousedown, not click: runs before the field loses focus and closes the list.
              onMouseDown={e => {
                e.preventDefault();
                pick(option);
              }}
              className={`px-3 py-1.5 cursor-pointer ${
                i === active
                  ? dark
                    ? 'bg-slate-600'
                    : 'bg-slate-100'
                  : dark
                    ? 'hover:bg-slate-700'
                    : 'hover:bg-slate-50'
              } ${option.toLowerCase() === q ? 'font-semibold' : ''}`}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
