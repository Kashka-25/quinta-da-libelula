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
import { MODELS, preload, webglOK } from './three/dragonflyModel';
import type { HeroEntry } from './three/HeroDragonfly';

type Stage = 'intro' | 'crossing' | 'site';

const FILM = {
  webm: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-720.webm`,
  mp4: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-720.mp4`,
  webmSmall: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-540.webm`,
  mp4Small: `${import.meta.env.BASE_URL}intro/dragonfly-transformation-540.mp4`,
};

export default function App() {
  // fetch the reborn dragonfly while the intro plays, so it's ready for the homepage
  useEffect(() => {
    if (webglOK()) preload(MODELS.reborn).catch(() => {});
  }, []);
  const [kind, setKind] = useState<IntroKind>(chooseIntro);
  const [stage, setStage] = useState<Stage>(kind === 'none' ? 'site' : 'intro');
  const [origin, setOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [showSite, setShowSite] = useState(stage === 'site');
  const [enquiry, setEnquiry] = useState<string>('');
  // how the reborn dragonfly enters the hero: flown in by the intro (handoff),
  // out of the light bloom (fly), or from beyond the trees on a direct visit
  const [heroEntry, setHeroEntry] = useState<HeroEntry>(stage === 'site' ? 'direct' : 'fly');
  const [heroReady, setHeroReady] = useState(true);

  useEffect(() => {
    document.body.classList.toggle('is-locked', stage !== 'site');
  }, [stage]);

  useScrollMotion(showSite);

  const enter = useCallback((o: { x: number; y: number }, handoff?: boolean) => {
    markIntroSeen();
    if (handoff) {
      setStage('site');
      return;
    }
    setOrigin(o);
    setStage('crossing');
  }, []);

  const reveal = useCallback(() => {
    setHeroEntry('handoff');
    setHeroReady(false);
    setShowSite(true);
  }, []);

  const replay = () => {
    window.scrollTo({ top: 0 });
    setShowSite(false);
    setHeroEntry('fly');
    setHeroReady(true);
    setKind(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'still' : 'canvas');
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
            <SanctuaryHomepage arriving={stage !== 'site'} heroEntry={heroEntry} heroReady={heroReady} />
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
          <DragonflyIntro
            emblemSrc={img('Logo_QLL-emblem.png')}
            onEnter={enter}
            onReveal={reveal}
            onHandoff={() => setHeroReady(true)}
            still={kind === 'still'}
          />
        ))}
      {stage === 'crossing' && (
        <IntroTransition origin={origin} onCovered={() => setShowSite(true)} onDone={() => setStage('site')} />
      )}
      <div className="grain" aria-hidden="true" />
    </>
  );
}
