import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import ScrollPortfolio from './ScrollPortfolio.jsx';
import ProjectPage from './components/project/ProjectPage.jsx';

export default function App() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const el = document.querySelector(location.hash);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<ScrollPortfolio />} />
        <Route path="/project" element={<ProjectPage />} />
      </Routes>
    </AnimatePresence>
  );
}
