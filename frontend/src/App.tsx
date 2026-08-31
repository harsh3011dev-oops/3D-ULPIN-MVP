import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import UploadPage from './pages/UploadPage';
import ProcessingPage from './pages/ProcessingPage';
import MapPage from './pages/MapPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/processing/:jobId" element={<ProcessingPage />} />
        <Route path="/map/:buildingId" element={<MapPage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </Router>
  );
}
