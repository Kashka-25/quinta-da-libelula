import { NAV, img } from '../content/site';

export default function Footer({ onReplay }: { onReplay: () => void }) {
  return (
    <footer className="footer">
      <img className="footer__emblem" src={img('Logo_QLL-emblem.png')} alt="Quinta da Libélula Retreats" />
      <nav aria-label="Footer">
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`}>
            {n.label}
          </a>
        ))}
      </nav>
      <button className="footer__replay" onClick={onReplay}>
        ↺ Watch the dragonfly again
      </button>
      <p className="footer__small">
        A concept demonstration for a new Quinta da Libélula website. Not the official site. Facts, words and photographs come
        from quintadalibelula.center; retreat names, dates and the map are illustrative.
      </p>
      <style>{`
        .footer { background: var(--forest-deep); color: var(--ivory); padding: 90px var(--gutter) 60px; display: grid; justify-items: center; gap: 30px; text-align: center; }
        .footer__emblem { width: 180px; opacity: .9; }
        .footer nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 26px; }
        .footer nav a { text-decoration: none; font-size: .9rem; opacity: .8; }
        .footer nav a:hover { opacity: 1; text-decoration: underline; text-underline-offset: 4px; }
        .footer__replay { background: none; border: 1px solid rgba(246,241,230,.3); border-radius: 999px; padding: 12px 20px; cursor: pointer; font-family: var(--serif); font-style: italic; }
        .footer__replay:hover { background: rgba(246,241,230,.1); }
        .footer__small { max-width: 60ch; font-size: .78rem; opacity: .6; margin: 0; }
      `}</style>
    </footer>
  );
}
