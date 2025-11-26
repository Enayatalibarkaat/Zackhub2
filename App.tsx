import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Movie, MovieCategory, CurrentUser } from './types';
import Sidebar from './Sidebar';
import MovieGrid from './MovieGrid';
import MovieDetails from './MovieDetails';
import LoginPanel from './LoginPanel';
import AdminPanel from './AdminPanel';
import Header from './Header';
import CategoryNav from './CategoryNav';
import Pagination from './Pagination';
import Footer from './Footer';
import DisclaimerModal from './DisclaimerModal';

type Theme = 'light' | 'dark';
const MOVIES_PER_PAGE = 30;

const App: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MovieCategory | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLiveEditMode, setIsLiveEditMode] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  // --- FIX: Scroll to Top on Route Change ---
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // --- Auth Check ---
  const canUserLiveEdit = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'super') return true;
    if ('permissions' in currentUser && currentUser.permissions) {
      return !!currentUser.permissions.canLiveEdit;
    }
    return false;
  }, [currentUser]);

  useEffect(() => {
    if (!canUserLiveEdit) setIsLiveEditMode(false);
  }, [canUserLiveEdit]);

  const effectiveLiveEditMode = isLiveEditMode && canUserLiveEdit;

  // --- Load Movies ---
  useEffect(() => {
    fetch("/.netlify/functions/trackVisit", { method: "POST" }).catch(console.error);
    (async () => {
      try {
        const res = await fetch("/.netlify/functions/getMovies");
        const json = await res.json();
        setMovies((json.movies || []) as Movie[]);
      } catch (err) {
        console.error("Failed to fetch movies", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // --- Theme ---
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(savedTheme || (prefersDark ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Calculate Genres from Movies (Ye wapas add kiya hai) ---
  const allGenres = useMemo(() => {
    const genreSet = new Map<number, string>();
    movies.forEach(movie => {
      movie.genres?.forEach(genre => {
        if (!genreSet.has(genre.id)) {
          genreSet.set(genre.id, genre.name);
        }
      });
    });
    return Array.from(genreSet.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [movies]);

  // --- Helpers ---
  const handleLogoClick = () => {
    if (location.pathname !== '/') {
      navigate('/');
      return;
    }
    setLogoClickCount(prev => prev + 1);
    setTimeout(() => setLogoClickCount(0), 1500);
    if (logoClickCount === 2) navigate('/login');
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };
    // --- Components for Routes ---
  const MainContent = () => {
    const filteredMovies = useMemo(() => movies
      .filter(movie => selectedCategory === 'all' || movie.category === selectedCategory)
      .filter(movie => !selectedGenre || movie.genres?.some(g => g.name === selectedGenre))
      .filter(movie => movie.title.toLowerCase().includes(searchQuery.toLowerCase())),
      [movies, selectedCategory, selectedGenre, searchQuery]);

    const totalPages = Math.ceil(filteredMovies.length / MOVIES_PER_PAGE);
    const moviesForCurrentPage = filteredMovies.slice((currentPage - 1) * MOVIES_PER_PAGE, currentPage * MOVIES_PER_PAGE);

    // Grid Title Logic
    let gridTitle = '🔥 Latest Releases';
    if (searchQuery) gridTitle = `Results for "${searchQuery}"`;
    else if (selectedGenre) gridTitle = `${selectedGenre} Movies`;
    else if (selectedCategory !== 'all') gridTitle = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1);

    return (
      <>
        <CategoryNav selectedCategory={selectedCategory} onSelectCategory={(cat) => {
          setSelectedCategory(cat);
          setSelectedGenre(null);
          setCurrentPage(1);
        }} />
        
        <h1 className="text-3xl text-light-text dark:text-brand-text mb-6 mt-6 font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-brand-primary/20 via-brand-primary/5 to-transparent">
          {gridTitle}
        </h1>

        <MovieGrid 
          movies={moviesForCurrentPage} 
          onSelectMovie={(movie) => navigate(`/movie/${generateSlug(movie.title)}`, { state: { movieId: movie.id || movie._id } })}
          searchQuery={searchQuery} 
          isLiveEditMode={effectiveLiveEditMode} 
          onUpdateField={() => {}} // Placeholder
          isLoading={loading} 
        />
        
        {!loading && totalPages > 1 && (
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        )}
      </>
    );
  };

  const MovieDetailsWrapper = () => {
    // Find movie by Slug from URL or State ID
    const pathSlug = location.pathname.split('/').pop();
    const stateId = location.state?.movieId;
    
    const movie = movies.find(m => 
      (stateId && (m.id === stateId || m._id === stateId)) || 
      generateSlug(m.title) === pathSlug
    );

    if (!movie && !loading) return <div className="text-center p-10 text-white">Movie not found. <button onClick={() => navigate('/')} className="text-brand-primary underline">Go Home</button></div>;
    if (!movie) return <div className="text-center p-10 text-white">Loading...</div>;

    return (
      <MovieDetails 
        movie={movie} 
        onBack={() => navigate(-1)} 
        onGoHome={() => navigate('/')}
        isLiveEditMode={effectiveLiveEditMode}
        onUpdateField={(id, field, val) => {
          const newMovies = movies.map(m => (m.id === id || m._id === id) ? { ...m, [field]: val } : m);
          setMovies(newMovies);
        }}
      />
    );
  };

  // --- Main Render ---
  return (
    <div className="relative min-h-screen bg-light-bg dark:bg-brand-bg text-light-text dark:text-brand-text">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        genres={allGenres} // ⭐ Ye line fix kar di hai
        onSelectGenre={(g) => { setSelectedGenre(g); setSelectedCategory('all'); setIsSidebarOpen(false); }}
        selectedGenre={selectedGenre}
      />

      <div className="flex flex-col min-h-screen">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          onLogoClick={handleLogoClick}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showSearch={location.pathname === '/'}
        />
        
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<MainContent />} />
            <Route path="/movie/:slug" element={<MovieDetailsWrapper />} />
            <Route path="/login" element={<LoginPanel onLoginSuccess={(u) => { setCurrentUser(u); navigate('/admin'); }} onCancel={() => navigate('/')} />} />
            <Route path="/admin" element={currentUser ? <AdminPanel movies={movies} setMovies={setMovies} onLogout={() => { setCurrentUser(null); navigate('/'); }} currentUser={currentUser} /> : <Navigate to="/login" />} />
          </Routes>
        </main>
        
        <Footer onDisclaimerClick={() => setIsDisclaimerOpen(true)} />
      </div>

      <DisclaimerModal isOpen={isDisclaimerOpen} onClose={() => setIsDisclaimerOpen(false)} />
      
      {/* Live Edit Toggle Button */}
      {canUserLiveEdit && (
        <div className="fixed bottom-5 right-5 z-50">
           <label htmlFor="live-edit-toggle" className="flex items-center cursor-pointer bg-light-card dark:bg-brand-card p-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700">
            <span className="mr-3 font-semibold text-sm text-light-text dark:text-brand-text">Live Edit</span>
            <div className="relative">
              <input id="live-edit-toggle" type="checkbox" className="sr-only peer" checked={isLiveEditMode} onChange={() => setIsLiveEditMode(!isLiveEditMode)} />
              <div className="w-14 h-8 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
              <div className="absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform peer-checked:translate-x-6 peer-checked:bg-brand-primary"></div>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default App;
