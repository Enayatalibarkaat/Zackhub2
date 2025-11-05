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

// Mock data to simulate fetching from a Telegram channel
const baseMovies: Movie[] = [
  { id: '1', title: 'Inception', category: 'hollywood', posterUrl: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq27gApcjBJU3GZpA.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', tagline: "Your mind is the scene of the crime.", description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.', downloadLinks: [{quality: '480p', url: '#'}, {quality: '720p', url: '#'}, {quality: '1080p', url: '#'}], telegramLinks: [{ quality: '1080p', fileId: 'ZackHub_Inception_2010' }], actors: 'Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page', director: 'Christopher Nolan', producer: 'Emma Thomas, Christopher Nolan', trailerLink: 'https://www.youtube.com/embed/YoHD9XEInc0', rating: 8.8, genres: [{id: 28, name: "Action"}, {id: 878, name: "Science Fiction"}, {id: 12, name: "Adventure"}], releaseDate: '2010-07-15', runtime: 148 },
  { id: '2', title: 'The Dark Knight', category: 'hollywood', posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/nMKdUUQPEd2biTe4iS0M5dBC7hE.jpg', tagline: "Why So Serious?", description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.', downloadLinks: [{quality: '720p', url: '#'}, {quality: '1080p', url: '#'}], actors: 'Christian Bale, Heath Ledger, Aaron Eckhart', director: 'Christopher Nolan', producer: 'Emma Thomas, Charles Roven, Christopher Nolan', trailerLink: 'https://www.youtube.com/embed/EXeTwQWrcwY', rating: 9.0, genres: [{id: 18, name: "Drama"}, {id: 28, name: "Action"}, {id: 80, name: "Crime"}, {id: 53, name: "Thriller"}], releaseDate: '2008-07-16', runtime: 152 },
  { id: '9', title: 'Stranger Things', category: 'webseries', posterUrl: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/56v2KjBlU4KZAG3sJSq8UClGB3t.jpg', tagline: "Every ending has a beginning.", description: 'When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces in order to get him back.', actors: 'Millie Bobby Brown, Finn Wolfhard, Winona Ryder', director: 'The Duffer Brothers', producer: 'Dan Cohen, Shawn Levy', trailerLink: 'https://www.youtube.com/embed/b9EkMc79ZSU', rating: 8.7, genres: [{id: 10765, name: "Sci-Fi & Fantasy"}, {id: 9648, name: "Mystery"}, {id: 18, name: "Drama"}], releaseDate: '2016-07-15', runtime: 50, seasons: [{ seasonNumber: 1, episodes: [{ episodeNumber: 1, title: 'Chapter One: The Vanishing of Will Byers', downloadLinks: [{ quality: '720p', url: '#' }, { quality: '1080p', url: '#' }], telegramLinks: [{ quality: '1080p', fileId: 'ZackHub_ST_S01E01' }] }, { episodeNumber: 2, title: 'Chapter Two: The Weirdo on Maple Street', downloadLinks: [{ quality: '720p', url: '#' }, { quality: '1080p', url: '#' }] }, { episodeNumber: 3, title: 'Chapter Three: Holly, Jolly', downloadLinks: [{ quality: '720p', url: '#' }, { quality: '1080p', url: '#' }] }] }, { seasonNumber: 2, episodes: [{ episodeNumber: 1, title: 'Chapter One: MADMAX', downloadLinks: [{ quality: '720p', url: '#' }], telegramLinks: [{ quality: '720p', fileId: 'ZackHub_ST_S02E01' }] }] }] },
  { id: '10', title: '3 Idiots', category: 'bollywood', posterUrl: 'https://image.tmdb.org/t/p/w500/66A9OLJjKya45Q5LCoYLzB04C22.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/u6yYEvpOdv5gGg3T3m4tAG6S5DR.jpg', tagline: "Don't be stupid. Be an I.D.I.O.T.", description: 'Two friends are searching for their long lost companion. They revisit their college days and recall the memories of their friend who inspired them to think differently, even as the rest of the world called them "idiots".', downloadLinks: [{quality: '480p', url: '#'}, {quality: '720p', url: '#'}], actors: 'Aamir Khan, R. Madhavan, Sharman Joshi', director: 'Rajkumar Hirani', producer: 'Vidhu Vinod Chopra', trailerLink: 'https://www.youtube.com/embed/K0e-N_b-p-g', rating: 8.4, genres: [{id: 18, name: "Drama"}, {id: 35, name: "Comedy"}], releaseDate: '2009-12-23', runtime: 170 },
  { id: '11', title: 'Baahubali: The Beginning', category: 'south-indian', posterUrl: 'https://image.tmdb.org/t/p/w500/9J1SoiS9t2p6aIJVp0dsk2e3aI.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/6AZpQv5uc3rLwT3J0r1ZgSA8p8k.jpg', description: 'In ancient India, an adventurous and daring man becomes involved in a decades-old feud between two warring kingdoms.', downloadLinks: [{quality: '720p', url: '#'}], actors: 'Prabhas, Rana Daggubati, Anushka Shetty', director: 'S. S. Rajamouli', producer: 'Shobu Yarlagadda, Prasad Devineni', rating: 7.6, genres: [{id: 28, name: "Action"}, {id: 12, name: "Adventure"}, {id: 18, name: "Drama"}], releaseDate: '2015-07-10', runtime: 159 },
  { id: '4', title: 'Parasite', category: 'south-indian', posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', backdropUrl: 'https://image.tmdb.org/t/p/w1280/hiK4qc0tZijQ9KNUnS4sP3fN3d.jpg', tagline: "Act like you own the place.", description: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.', downloadLinks: [{quality: '1080p', url: '#'}], actors: 'Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong', director: 'Bong Joon Ho', producer: 'Kwak Sin-ae, Moon Yang-kwon', trailerLink: 'https://www.youtube.com/embed/5xH0HfJHsaY', rating: 8.5, genres: [{id: 35, name: "Comedy"}, {id: 53, name: "Thriller"}, {id: 18, name: "Drama"}], releaseDate: '2019-05-30', runtime: 132 },
];


// Expand the movie list to test pagination
const fallbackMovies: Movie[] = Array.from({ length: 4 }).flatMap((_, index) => 
  baseMovies.map(movie => ({
    ...movie,
    id: `${movie.id}-${index}`,
    title: `${movie.title} ${index > 0 ? index + 1 : ''}`.trim()
  }))
);


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

  useEffect(() => {
    try {
        const savedMovies = localStorage.getItem('zackhub-movies');
        if (savedMovies) {
            setMovies(JSON.parse(savedMovies));
        } else {
            // First time load, save initial movies to storage
            localStorage.setItem('zackhub-movies', JSON.stringify(fallbackMovies));
            setMovies(fallbackMovies);
        }
    } catch (error) {
        console.error("Failed to load movies from localStorage", error);
        setMovies(fallbackMovies); // Fallback to initial data
    }
  }, []);

  useEffect(() => {
    try {
        localStorage.setItem('zackhub-movies', JSON.stringify(movies));
    } catch (error) {
        console.error("Failed to save movies to localStorage", error);
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
    // Scroll to top when navigating to details page
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
    }, 1500); // Reset after 1.5 seconds of inactivity
    setLogoClickTimer(timer);
  }, [logoClickTimer, view, handleGoHome]);

  const handleSelectMovie = (movie: Movie) => {
    if (effectiveLiveEditMode) return; // Prevent navigation in live edit mode
    scrollPositionRef.current = window.scrollY; // Save scroll position
    setSelectedMovie(movie);
    setView('details');
  };

  const handleBack = () => {
    const isComingFromDetails = view === 'details';

    setSelectedMovie(null);
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedGenre(null);
    setView('main');
    
    if (isComingFromDetails) {
        // Defer scroll restoration until after the main view is rendered.
        setTimeout(() => {
            window.scrollTo(0, scrollPositionRef.current);
        }, 0);
    }
  };
  
  const handleLoginSuccess = (user: CurrentUser) => {
    setCurrentUser(user);
    setView('admin');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLiveEditMode(false); // Disable edit mode on logout
    setView('main');
  };

  const handleSelectCategory = (category: MovieCategory | 'all') => {
    setSelectedCategory(category);
    setSelectedGenre(null); // Reset genre when category changes
    setCurrentPage(1);
  };

  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setSelectedCategory('all'); // Reset category when genre changes
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
    return Array.from(genreSet.entries()).map(([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name));
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
            <MovieGrid movies={moviesForCurrentPage} onSelectMovie={handleSelectMovie} searchQuery={searchQuery} isLiveEditMode={effectiveLiveEditMode} onUpdateField={handleUpdateMovieField} />
            {totalPages > 1 && (
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
