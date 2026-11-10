import { useCallback, useEffect, useState } from 'react';
import DragonflyIntro from './intro/DragonflyIntro';
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

function initialStage(): Stage {
  const q = new URLSearchParams(window.location.search);
  if (q.has('skip') || window.location.hash.length > 1) return 'site';
  return 'intro';
}

export default function App() {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [origin, setOrigin] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [showSite, setShowSite] = useState(stage === 'site');
  const [enquiry, setEnquiry] = useState<string>('');
  const forceStill = new URLSearchParams(window.location.search).get('intro') === 'still';

  useEffect(() => {
    document.body.classList.toggle('is-locked', stage !== 'site');
  }, [stage]);

  useScrollMotion(showSite);

  const enter = useCallback((o: { x: number; y: number }) => {
    setOrigin(o);
    setStage('crossing');
  }, []);

  const replay = () => {
    window.scrollTo({ top: 0 });
    setShowSite(false);
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
      {(stage === 'intro' || (stage === 'crossing' && !showSite)) && (
        <DragonflyIntro emblemSrc={img('Logo_QLL-emblem.png')} onEnter={enter} still={forceStill} />
      )}
      {stage === 'crossing' && (
        <IntroTransition origin={origin} onCovered={() => setShowSite(true)} onDone={() => setStage('site')} />
      )}
      <div className="grain" aria-hidden="true" />
    </>
  );
}
