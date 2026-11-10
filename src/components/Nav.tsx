import { useEffect, useState } from 'react';
import { NAV, img } from '../content/site';
import './nav.css';

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) io.observe(el);
    });
    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav ${solid ? 'nav--solid' : ''} ${open ? 'nav--open' : ''}`}>
      <a href="#home" className="nav__brand" aria-label="Quinta da Libélula, back to the top" onClick={() => setOpen(false)}>
        <img src={img('Logo_QLL-Libelula.png')} alt="" width="34" height="22" />
        <span>
          Quinta da <em>Libélula</em>
        </span>
      </a>
      <span className="nav__concept" title="This is a design concept, not the official website">
        Concept
      </span>
      <nav aria-label="Sections">
        <ul className="nav__links">
          {NAV.map((n) => (
            <li key={n.id}>
              <a href={`#${n.id}`} className={active === n.id ? 'is-active' : ''} onClick={() => setOpen(false)}>
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button className="nav__toggle" aria-expanded={open} aria-controls="nav-sheet" onClick={() => setOpen((o) => !o)}>
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        <i />
        <i />
      </button>
      <div id="nav-sheet" className="nav__sheet" hidden={!open}>
        <ul>
          {NAV.map((n, i) => (
            <li key={n.id} style={{ transitionDelay: `${0.05 * i + 0.1}s` }}>
              <a href={`#${n.id}`} onClick={() => setOpen(false)}>
                <small>0{i + 1}</small>
                {n.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
