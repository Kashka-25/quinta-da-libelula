import { PILLARS, img } from '../content/site';
import './sanctuary.css';

const FACTS = [
  { n: '8', label: 'hectares of nature' },
  { n: '6', label: 'domes inspired by the chakras' },
  { n: '∞', label: 'mountains, forests and endless skies' },
];

export default function Sanctuary() {
  return (
    <section id="sanctuary" className="section sanct">
      <div className="wrap sanct__grid">
        <div className="sanct__text">
          <p className="eyebrow reveal">The Sanctuary</p>
          <h2 className="display reveal">
            Where nature, connection and <em>transformation</em> meet.
          </h2>
          <p className="lede reveal">
            A green retreat centre in the rolling hills of Coimbra, where untouched nature meets ancient wisdom.
          </p>
          <p className="reveal sanct__body">
            Yoga, healing and nature in harmony. Days for community, celebration and transformation, and for
            simply slowing down, with the land as your teacher, your mirror, your medicine.
          </p>
        </div>

        <div className="sanct__images">
          <figure className="sanct__img sanct__img--a reveal" data-speed="-0.12">
            <img src={img('eco-1.webp')} alt="White domes along a wooden walkway on a green hillside" loading="lazy" />
          </figure>
          <figure className="sanct__img sanct__img--b reveal" data-speed="0.18">
            <img src={img('eco-2-sm.webp')} alt="A wooden pavilion among the trees on the hillside" loading="lazy" />
          </figure>
          <svg className="sanct__fern draw" viewBox="0 0 200 420" aria-hidden="true">
            <path d="M100 410 C 98 320 104 220 96 120 S 92 40 104 10" />
            {Array.from({ length: 14 }, (_, i) => {
              const y = 380 - i * 25;
              const l = 70 - i * 4.2;
              return (
                <g key={i}>
                  <path d={`M${99 - i * 0.2} ${y} C ${80 - l * 0.3} ${y - 12} ${90 - l} ${y - 20} ${96 - l} ${y - 34}`} />
                  <path d={`M${100 - i * 0.2} ${y - 8} C ${118 + l * 0.3} ${y - 20} ${110 + l} ${y - 28} ${104 + l} ${y - 42}`} />
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <ul className="wrap sanct__facts">
        {FACTS.map((f) => (
          <li key={f.label} className="reveal">
            <strong>{f.n}</strong>
            <span>{f.label}</span>
          </li>
        ))}
      </ul>

      <div className="wrap sanct__pillars">
        {PILLARS.map((p, i) => (
          <article key={p.word} className="pillar reveal" style={{ ['--i' as string]: i }}>
            <span className="pillar__no">0{i + 1}</span>
            <h3>{p.word}</h3>
            <p>{p.line}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
