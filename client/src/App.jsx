import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import AuthModal from './components/AuthModal.jsx';
import TasbihWidget from './components/TasbihWidget.jsx';
import HomePage from './pages/HomePage.jsx';
import HadithsPage from './pages/HadithsPage.jsx';
import StoriesPage from './pages/StoriesPage.jsx';
import StoryDetailPage from './pages/StoryDetailPage.jsx';
import SermonsPage from './pages/SermonsPage.jsx';
import ForumPage from './pages/ForumPage.jsx';
import TopicDetailPage from './pages/TopicDetailPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ModerationPage from './pages/ModerationPage.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hadiths" element={<HadithsPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/stories/:slug" element={<StoryDetailPage />} />
          <Route path="/sermons" element={<SermonsPage />} />
          <Route path="/forum" element={<ForumPage />} />
          <Route path="/forum/topic/:id" element={<TopicDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/moderation" element={<ModerationPage />} />
        </Routes>
      </main>
      <footer className="border-t border-[var(--border-subtle)] py-6 text-center text-xs text-[var(--text-muted)]">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span className="font-amiri text-base text-[var(--gold)]">۞ مِشكاة — نورُ العلمِ ومجلسُ الذكر</span>
          <span>المنتدى للتعلم والتدبر المجتمعي؛ وللفتاوى الخاصة يُستفتى أهل العلم والمؤسسات المعتمدة.</span>
        </div>
      </footer>
      <AuthModal />
      <TasbihWidget />
    </div>
  );
}
