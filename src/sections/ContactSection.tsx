import { useState } from 'react';
import { CONTACT, RETREATS, STAYS, img } from '../content/site';
import './contact.css';

/**
 * Demonstration only: the form never sends, stores or logs anything.
 * Submitting shows what the experience could feel like.
 */
export default function ContactSection({ topic, onTopic }: { topic: string; onTopic: (t: string) => void }) {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');

  const options = ['A visit to the Quinta', ...RETREATS.map((r) => r.name), ...STAYS.map((s) => `Stay: ${s.name}`)];

  return (
    <section id="enquire" className="section contact">
      <svg className="edge edge--top" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0 H1440 V40 C 1200 90 960 30 720 60 S 240 90 0 40Z" fill="var(--ivory)" />
      </svg>
      <div className="wrap contact__grid">
        <div className="contact__intro">
          <p className="eyebrow reveal">Enquire</p>
          <h2 className="display reveal">
            When you are ready, <em>the land is waiting</em>.
          </h2>
          <dl className="contact__facts reveal">
            <div>
              <dt>Write</dt>
              <dd>
                <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
              </dd>
            </div>
            <div>
              <dt>Find us</dt>
              <dd>{CONTACT.place}, in the hills of Coimbra</dd>
            </div>
            <div>
              <dt>Getting here</dt>
              <dd>
                <ul>
                  {CONTACT.travel.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>Weather</dt>
              <dd>{CONTACT.climate}</dd>
            </div>
          </dl>
        </div>

        <div className="contact__card reveal">
          {sent ? (
            <div className="contact__sent" role="status">
              <img src={img('Logo_QLL-Libelula.png')} alt="" className="contact__fly" />
              <h3>Thank you{name ? `, ${name.split(' ')[0]}` : ''}.</h3>
              <p>In the real site, your message would fly to the team now.</p>
              <p className="contact__demo">This is a demonstration. Nothing was sent or saved.</p>
              <button className="btn" onClick={() => setSent(false)}>
                Back to the form
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <img className="contact__logo" src={img('Logo_QLL-rec.png')} alt="Quinta da Libélula" width="508" height="180" />
              <p className="contact__demo">
                <span className="demo-tag">Demo form</span> Nothing you type here leaves this page.
              </p>
              <label>
                <span>Your name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="How shall we call you?" />
              </label>
              <label>
                <span>Email</span>
                <input type="email" autoComplete="off" placeholder="So we can write back" />
              </label>
              <label>
                <span>I'm drawn to</span>
                <select value={topic || options[0]} onChange={(e) => onTopic(e.target.value)}>
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>A few words</span>
                <textarea rows={4} placeholder="What are you hoping to find here?" />
              </label>
              <button type="submit" className="btn btn--solid contact__submit">
                Send into the forest <span className="arrow">→</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
