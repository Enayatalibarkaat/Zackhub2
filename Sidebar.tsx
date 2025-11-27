import React, { useState } from 'react';
import { Genre } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  genres: Genre[];
  onSelectGenre: (genreName: string) => void;
  selectedGenre: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, theme, toggleTheme, genres, onSelectGenre, selectedGenre }) => {
  const [isGenreOpen, setIsGenreOpen] = useState(true);

  // --- NEW: Request Feature States ---
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- NEW: Handle Request Submit ---
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestTitle.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/.netlify/functions/manageRequests", {
        method: "POST",
        body: JSON.stringify({ title: requestTitle }),
      });
      if (res.ok) {
        alert("Request sent successfully! ✅");
        setRequestTitle("");
        setIsRequestModalOpen(false);
      } else {
        alert("Something went wrong ❌");
      }
    } catch (error) {
      alert("Failed to send request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <aside 
        className={`fixed top-0 left-0 h-full w-72 bg-light-sidebar dark:bg-brand-sidebar shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-light-text dark:text-brand-text">Menu</h2>
                <button onClick={onClose} className="p-2 rounded-md text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors" aria-label="Close menu">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            
            <nav className="flex-grow p-4 space-y-2 overflow-y-auto">
                
                {/* --- NEW: Request Button (Placed above Dark Mode) --- */}
                <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="w-full flex items-center gap-4 p-3 rounded-lg text-light-text dark:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-light-text-secondary dark:text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium">Request Movies</span>
                </button>

                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-4 p-3 rounded-lg text-light-text dark:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-light-text-secondary dark:text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-light-text-secondary dark:text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    )}
                    <span className="font-medium">{theme === 'light' ? 'Dark' : 'Light'} Mode</span>
                </button>
                
                <div>
                    <button
                        onClick={() => setIsGenreOpen(!isGenreOpen)}
                        className="w-full flex items-center justify-between gap-4 p-3 rounded-lg text-light-text dark:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        aria-expanded={isGenreOpen}
                        aria-controls="genre-list"
                    >
                        <div className="flex items-center gap-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-light-text-secondary dark:text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="font-medium">Genre</span>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-light-text-secondary dark:text-brand-text-secondary transition-transform duration-300 ${isGenreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div 
                        id="genre-list"
                        className={`overflow-hidden transition-all duration-500 ease-in-out ${isGenreOpen ? 'max-h-[1000px]' : 'max-h-0'}`}
                    >
                        <div className="pt-2 pl-6 space-y-1">
                            {genres.map((genre) => {
                                const isActive = selectedGenre === genre.name;
                                return (
                                    <button
                                        key={genre.id}
                                        onClick={() => onSelectGenre(genre.name)}
                                        className={`w-full text-left block p-2 rounded-lg transition-colors ${
                                            isActive 
                                            ? 'bg-brand-primary/20 text-brand-primary' 
                                            : 'text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/5 dark:hover:bg-white/5 hover:text-light-text dark:hover:text-brand-text'
                                        }`}
                                    >
                                        {genre.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <a 
                    href="https://t.me/captain_stive" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-4 p-3 rounded-lg text-light-text dark:text-brand-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-light-text-secondary dark:text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Help</span>
                </a>
            </nav>
        </div>
      </aside>
      
      {/* --- NEW: Request Modal Popup --- */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl relative animate-bounce-in">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Request Content</h3>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    Enter the name of the movie or series you want us to add:
                </p>
                <form onSubmit={handleRequestSubmit}>
                    <input
                        type="text"
                        placeholder="e.g. Stranger Things, Avengers..."
                        value={requestTitle}
                        onChange={(e) => setRequestTitle(e.target.value)}
                        className="w-full p-3 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                        required
                    />
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setIsRequestModalOpen(false)}
                            className="px-4 py-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            {isSubmitting ? "Sending..." : "Send Request"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {isOpen && (
        <div 
          onClick={onClose} 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
          aria-hidden="true"
        />
      )}
    </>
  );
};

export default Sidebar;
      
