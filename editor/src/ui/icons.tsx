// Inline SVG icons, one 1.6 stroke (paths from the approved mockup where it has them).
import type { JSX } from 'preact';

const PATHS = {
  edit: <path d="m4 4 7 17 2.5-7.5L21 11z" />,
  insert: <path d="M5 6V4h14v2M12 4v16M9 20h6" />,
  motion: <path d="M4 12h6M14 12h6M8 8l-4 4 4 4M16 8l4 4-4 4" />,
  identity: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16z" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  warn: <path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  chevronUp: <path d="m6 15 6-6 6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  export: <path d="M12 15V4M8 8l4-4 4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.5" /></>,
  eyeOff: <><path d="M3 3l18 18M10.5 6.2A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.2 7.3C3.8 9.1 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 2-.2" /></>,
} satisfies Record<string, JSX.Element>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, class: cls }: { name: IconName; class?: string }) {
  return (
    <svg class={`i${cls ? ` ${cls}` : ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
