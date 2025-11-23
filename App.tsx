import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Movie, MovieCategory, Genre, CurrentUser } from './types';
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

type View = 'main' | 'details' | 'login' | 'admin';
type Theme = 'light' | 'dark';

const MOVIES_PER_PAGE = 30;

const App: React.FC = () => {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [view, setView] = useState<View>('main');
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [logoClickTimer, setLogoClickTimer] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<MovieCategory | 'all'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const scrollPositionRef = useRef(0);
  const [isLiveEditMode, setIsLiveEditMode] = useState(false);
  
  // --- NEW: Loading State (Shuru mein True rahega) ---
  const [loading, setLoading] = useState(true);

  const canUserLiveEdit = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'super') return true;
    if ('permissions' in currentUser && currentUser.permissions) {
      return !!currentUser.permissions.canLiveEdit;
    }
    return false;
  }, [currentUser]);

  useEffect(() => {
    if (!canUserLiveEdit) {
      setIsLiveEditMode(false);
    }
  }, [canUserLiveEdit]);

  const effectiveLiveEditMode = isLiveEditMode && canUserLiveEdit;

  // ⭐ Load movies with Loading Logic
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/.netlify/functions/getMovies");
        const json = await res.json();
        setMovies((json.movies || []) as Movie[]);
      } catch (err) {
        console.error("Failed to fetch movies from API", err);
        setMovies([]);
      } finally {
        // --- NEW: Jab data aa jaye ya error aaye, loading band kar do ---
        setLoading(false);
      }
    })();
  }, []);

  // ⭐ Restore LAST VIEW on refresh
  useEffect(() => {
    const lastView = localStorage.getItem("last-view");
    const lastMovieId = localStorage.getItem("last-movie-id");

    if (lastView === "details" && lastMovieId) {
      const movie = movies.find(m => (m.id || m._id) === lastMovieId);
      if (movie) {
        setSelectedMovie(movie);
        setView("details");
      }
    }

    if (lastView === "admin") {
      setView("admin");
    }

  }, [movies]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (prefersDark) {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (logoClickCount === 3) {
      setView('login');
      setLogoClickCount(0);
      if (logoClickTimer) clearTimeout(logoClickTimer);
    }
  }, [logoClickCount, logoClickTimer]);

  useEffect(() => {
    if (view === 'details') {
      window.scrollTo(0, 0);
    }
  }, [view]);

  const handleGoHome = useCallback(() => {
    setSelectedMovie(null);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedGenre(null);
    setView('main');
    localStorage.setItem("last-view", "main");
    window.scrollTo(0, 0);
  }, []);

  const handleLogoClick = useCallback(() => {
    if (view !== 'main') {
      handleGoHome();
    }

    if (logoClickTimer) {
      clearTimeout(logoClickTimer);
    }
    setLogoClickCount(prev => prev + 1);
    const timer = setTimeout(() => {
      setLogoClickCount(0);
    }, 1500);
    setLogoClickTimer(timer);
  }, [logoClickTimer, view, handleGoHome]);

  const handleSelectMovie = (movie: Movie) => {
    if (effectiveLiveEditMode) return;
    scrollPositionRef.current = window.scrollY;
    setSelectedMovie(movie);
    setView('details');
    localStorage.setItem("last-view", "details");
    localStorage.setItem("last-movie-id", movie.id || movie._id);
  };

  const handleBack = () => {
    const isComingFromDetails = view === 'details';
    setSelectedMovie(null);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedGenre(null);
    setView('main');
    localStorage.setItem("last-view", "main");

    if (isComingFromDetails) {
      setTimeout(() => {
        window.scrollTo(0, scrollPositionRef.current);
      }, 0);
    }
  };

  const handleLoginSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    setView('admin');
    localStorage.setItem("last-view", "admin");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLiveEditMode(false);
    setView('main');
    localStorage.setItem("last-view", "main");
  };

  const handleSelectCategory = (category: MovieCategory | 'all') => {
    setSelectedCategory(category);
    setSelectedGenre(null);
    setCurrentPage(1);
  };

  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setSelectedCategory('all');
    setCurrentPage(1);
    setIsSidebarOpen(false);
  };

  const handleUpdateMovieField = (movieId: string, field: keyof Movie, value: any) => {
    const newMovies = movies.map(movie =>
      movie.id === movieId ? { ...movie, [field]: value } : movie
    );
    setMovies(newMovies);

    if (selectedMovie?.id === movieId) {
      const updatedSelectedMovie = newMovies.find(m => m.id === movieId);
      if (updatedSelectedMovie) {
        setSelectedMovie(updatedSelectedMovie);
      }
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredMovies = useMemo(() => movies
    .filter(movie => selectedCategory === 'all' || movie.category === selectedCategory)
    .filter(movie => !selectedGenre || movie.genres?.some(g => g.name === selectedGenre))
    .filter(movie => movie.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [movies, selectedCategory, selectedGenre, searchQuery]);

  const totalPages = Math.ceil(filteredMovies.length / MOVIES_PER_PAGE);
  const indexOfLastMovie = currentPage * MOVIES_PER_PAGE;
  const indexOfFirstMovie = indexOfLastMovie - MOVIES_PER_PAGE;
  const moviesForCurrentPage = filteredMovies.slice(indexOfFirstMovie, indexOfLastMovie);

  const allGenres = useMemo(() => {
    const genreSet = new Map<number, string>();
    movies.forEach(movie => {
      movie.genres?.forEach(genre => {
        if (!genreSet.has(genre.id)) {
          genreSet.set(genre.id, genre.name);
        }
      });
    });
    return Array.from(genreSet.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [movies]);

  const getGridTitle = () => {
    if (searchQuery) return `Results for "${searchQuery}"`;
    if (selectedGenre) return `${selectedGenre} Movies & Series`;
    switch (selectedCategory) {
      case 'all': return '🔥 Latest Releases';
      case 'webseries': return 'Webseries';
      case 'hollywood': return 'Hollywood';
      case 'bollywood': return 'Bollywood';
      case 'south-indian': return 'South Indian';
      default: return 'Content';
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'login':
        return <LoginPanel onLoginSuccess={handleLoginSuccess} onCancel={handleBack} />;
      case 'admin':
        return <AdminPanel movies={movies} setMovies={setMovies} onLogout={handleLogout} currentUser={currentUser} />;
      case 'details':
        return selectedMovie && <MovieDetails movie={selectedMovie} onBack={handleBack} onGoHome={handleGoHome} isLiveEditMode={effectiveLiveEditMode} onUpdateField={handleUpdateMovieField} />;
      case 'main':
      default:
        const isLatestReleases = !searchQuery && !selectedGenre && selectedCategory === 'all';
        return (
          <>
            <CategoryNav selectedCategory={selectedCategory} onSelectCategory={handleSelectCategory} />
            <h1 className={`text-3xl text-light-text dark:text-brand-text mb-6 mt-6 ${
              isLatestReleases
                ? 'inline-block font-bold px-4 py-2 rounded-lg bg-gradient-to-r from-brand-primary/20 via-brand-primary/5 to-transparent'
                : 'font-light'
            }`}>
              {getGridTitle()}
            </h1>
            
            {/* --- NEW: Loading Prop Passed Here --- */}
            <MovieGrid 
              movies={moviesForCurrentPage} 
              onSelectMovie={handleSelectMovie} 
              searchQuery={searchQuery} 
              isLiveEditMode={effectiveLiveEditMode} 
              onUpdateField={handleUpdateMovieField}
              isLoading={loading} 
            />
            
            {/* Pagination tabhi dikhao jab loading khatam ho jaye */}
            {!loading && totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        );
    }
  };

  return (
    <div className="relative min-h-screen bg-light-bg dark:bg-brand-bg text-light-text dark:text-brand-text">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        theme={theme}
        toggleTheme={toggleTheme}
        genres={allGenres}
        onSelectGenre={handleSelectGenre}
        selectedGenre={selectedGenre}
      />

      <div className="flex flex-col min-h-screen">
        <Header
          onMenuClick={() => setIsSidebarOpen(true)}
          onLogoClick={handleLogoClick}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showSearch={view === 'main'}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {renderContent()}
        </main>
        <Footer onDisclaimerClick={() => setIsDisclaimerOpen(true)} />
      </div>

      <DisclaimerModal
        isOpen={isDisclaimerOpen}
        onClose={() => setIsDisclaimerOpen(false)}
      />

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
