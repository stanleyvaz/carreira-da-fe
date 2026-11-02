const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", width: 24, height: 24, viewBox: "0 0 24 24", "aria-hidden": true } as const;
export const IconSun = () => <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconBook = () => <svg {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M9 7h7" /></svg>;
export const IconHeart = () => <svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>;
export const IconRing = () => <svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></svg>;
export const IconCheck = () => <svg {...p} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconStar = ({ on }: { on?: boolean }) => <svg {...p} fill={on ? "currentColor" : "none"}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z" /></svg>;
export const IconMedal = () => <svg {...p}><circle cx="12" cy="14" r="5" /><path d="M8.5 3h7L14 9.5M8.5 3L10 9.5" /></svg>;
