import { useCallback, useEffect, useState } from 'react';
import DragonflyIntro from './intro/DragonflyIntro';
import CinematicIntro from './intro/CinematicIntro';
import { chooseIntro, markIntroSeen, type IntroKind } from './intro/introChoice';
import IntroTransition from './intro/IntroTransition';
import Nav from './components/Nav';
import Pollen from './components/Pollen';
import { useScrollMotion } from './components/motion';
import SanctuaryHomepage from './sections/SanctuaryHomepage';
import Sanctuary from './sections/Sanctuary';
import BreathPause from './sections/BreathPause';
import RetreatExplorer from './sections/RetreatExplorer';
import AccommodationExplorer from './sections/AccommodationExplorer';
import PracticesSection from './sections/PracticesSection';
import LandExperience from './sections/LandExperience';
import CommunitySection from './sections/CommunitySection';
import ContactSection from './sections/ContactSection';
import Footer from './sections/Footer';
import { img } from './content/site';

type Stage = 'intro' | 'crossing' | 'site';

const FILM = {
  webm: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-720.webm`,
  mp4: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-720.mp4`,
  webmSmall: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-540.webm`,
  mp4Small: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-540.mp4`,
};

export default function App() {
  const [kind, setKind] = useState<IntroKind>(chooseIntro);
  const [stage, setStage] = useState<Stage>(kind === 'none' ? 'site' : 'intro');
  const [origin, setOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [showSite, setShowSite] = useState(stage === 'site');
  const [enquiry, setEnquiry] = useState<string>('');

  useEffect(() => {
    document.body.classList.toggle('is-locked', stage !== 'site');
  }, [stage]);

  useScrollMotion(showSite);

  const enter = useCallback((o: { x: number; y: number }) => {
    markIntroSeen();
    setOrigin(o);
    setStage('crossing');
  }, []);

  const replay = () => {
    window.scrollTo({ top: 0 });
    setShowSite(false);
    setKind(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'still' : 'film');
    setStage('intro');
  };

  const enquire = (topic: string) => {
    setEnquiry(topic);
    document.getElementById('enquire')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      {showSite && (
        <>
          <Nav />
          <Pollen />
          <main>
            <SanctuaryHomepage arriving={stage !== 'site'} />
            <Sanctuary />
            <BreathPause />
            <RetreatExplorer onEnquire={enquire} />
            <AccommodationExplorer onEnquire={enquire} />
            <PracticesSection />
            <LandExperience />
            <CommunitySection />
            <ContactSection topic={enquiry} onTopic={setEnquiry} />
          </main>
          <Footer onReplay={replay} />
        </>
      )}
      {(stage === 'intro' || (stage === 'crossing' && !showSite)) &&
        (kind === 'film' ? (
          <CinematicIntro sources={FILM} logoSrc={img('Logo_QLL-rec.png')} onEnter={enter} onFallback={() => setKind('canvas')} />
        ) : (
          <DragonflyIntro emblemSrc={img('Logo_QLL-emblem.png')} onEnter={enter} still={kind === 'still'} />
        ))}
      {stage === 'crossing' && (
        <IntroTransition origin={origin} onCovered={() => setShowSite(true)} onDone={() => setStage('site')} />
      )}
      <div className="grain" aria-hidden="true" />
    </>
  );
}
