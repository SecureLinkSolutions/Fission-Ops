import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.tsx';
import { Catalog } from './pages/Catalog.tsx';
import { ContentUpdates } from './pages/ContentUpdates.tsx';
import { Coverage } from './pages/Coverage.tsx';
import { CveDetail } from './pages/CveDetail.tsx';
import { DataHealth } from './pages/DataHealth.tsx';
import { Library } from './pages/Library.tsx';
import { SecurityNews, ThreatIntel } from './pages/News.tsx';
import { Overview } from './pages/Overview.tsx';
import { RuleDetail } from './pages/RuleDetail.tsx';
import { Feedback, Licences, NotFound, Privacy } from './pages/Static.tsx';
import { Watchlist } from './pages/Watchlist.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/cve/:id" element={<CveDetail />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/news" element={<SecurityNews />} />
          <Route path="/intel" element={<ThreatIntel />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/rule/:platform/:id" element={<RuleDetail />} />
          <Route path="/updates" element={<ContentUpdates />} />
          <Route path="/health" element={<DataHealth />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/licences" element={<Licences />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </HashRouter>
  </StrictMode>,
);
