/** Tokens mirror ENEC NEXUS (space-separated RGB triplets in CSS variables) so Kafa'a looks native. */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), sunken: c('sunken'), panel: c('panel'), raised: c('raised'),
        line: c('line'), 'line-strong': c('line-strong'),
        ink: c('ink'), 'ink-2': c('ink-2'), 'ink-3': c('ink-3'),
        accent: c('accent'), 'accent-hover': c('accent-hover'), 'accent-ink': c('accent-ink'), 'accent-soft': c('accent-soft'),
        eyebrow: c('eyebrow'), navactive: c('navactive'), leaf: c('leaf'), sky: c('sky'),
        sim: c('sim'), 'sim-bg': c('sim-bg'), 'sim-line': c('sim-line'),
        ok: c('ok'), 'ok-bg': c('ok-bg'), 'ok-line': c('ok-line'),
        bad: c('bad'), 'bad-bg': c('bad-bg'), 'bad-line': c('bad-line'),
        info: c('info'), 'info-bg': c('info-bg'), 'info-line': c('info-line'),
        reserved: c('reserved'), 'reserved-bg': c('reserved-bg'), 'reserved-line': c('reserved-line'),
        'brand-teal': 'rgb(4 94 104)',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk Variable"', '"Hanken Grotesk"', '"IBM Plex Sans Arabic"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', '"Hanken Grotesk Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { btn: '8px', card: '12px', modal: '14px' },
      boxShadow: { card: 'var(--shadow-card)' },
    },
  },
  plugins: [],
};
