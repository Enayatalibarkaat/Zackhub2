import React, { useState } from 'react';
import { Movie, Episode } from '../types';
import ReactionPanel from './ReactionPanel';
import CommentBox from './CommentBox';
import EditableText from './EditableText';

interface MovieDetailsProps {
  movie: Movie;
  onBack: () => void;
  onGoHome: () => void;
  isLiveEditMode: boolean;
  onUpdateField: (movieId: string, field: keyof Movie, value: any) => void;
}

const InfoPill: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <span className="flex items-center gap-2 text-xs sm:text-sm text-light-text-secondary dark:text-brand-text-secondary bg-light-sidebar dark:bg-brand-card rounded-full px-3 py-1 shadow-sm">
        {icon}
        <span>{children}</span>
    </span>
);
const GenrePill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-xs font-semibold text-brand-primary bg-brand-primary/10 rounded-full px-3 py-1 [text-shadow:0_0_6px_theme(colors.brand-primary/80)]">
        {children}
    </span>
);

const MovieDetails: React.FC<MovieDetailsProps> = ({ movie, onBack, onGoHome, isLiveEditMode, onUpdateField }) => {
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  
  const formatRuntime = (minutes?: number) => {
    if (!minutes || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    let result = '';
    if (hours > 0) result += `${hours}h `;
    if (mins > 0) result += `${mins}m`;
    return result.trim();
  };
  const getTotalEpisodes = () => {
    if (!movie.seasons) return 0;
    return movie.seasons.reduce((total, season) => total + season.episodes.length, 0);
  };

  const EpisodeDownloadsModal: React.FC<{ episode: Episode, onClose: () => void }> = ({ episode, onClose }) => {
      return (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fade-in"
          onClick={onClose}
        >
          <div 
            className="bg-light-card dark:bg-brand-card p-6 rounded-xl shadow-2xl w-full max-w-xs m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-light-text dark:text-brand-text">
                    Episode {episode.episodeNumber}
                </h3>
                <button 
                    onClick={onClose} 
                    className="p-2 rounded-full text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/10 dark:hover:bg-white/10 hover:text-brand-primary transition-colors" 
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <p className="text-sm text-light-text-secondary dark:text-brand-text-secondary mb-4 truncate">{episode.title}</p>
            <div className="flex flex-col gap-3">
              {episode.telegramLinks?.map((link, index) => (
                <a
                  key={`tg-${index}`}
                  href={`https://t.me/Hubb_for_You_1bot?start=${link.fileId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 text-center bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-[0_0_15px_rgba(56,189,248,0.6)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23l7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3L3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.57c-.28 1.1-.86 1.32-1.7.82l-4.7-3.45l-2.4 2.3c-.27.27-.5.39-.83.39.35-.39.42-.64.48-.92z"/></svg>
                  <span>Telegram {link.quality}</span>
                </a>
              ))}
              {episode.downloadLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 text-center bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-[0_0_15px_rgba(252,71,71,0.6)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Download {link.quality}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      );
};

  const hasTelegramLink = movie.telegramLinks && movie.telegramLinks.length > 0;
  const hasDirectLinks = movie.downloadLinks && movie.downloadLinks.length > 0;

  return (
    <>
    <div className="animate-fade-in bg-light-bg dark:bg-brand-bg text-light-text dark:text-brand-text">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex justify-center items-center gap-4">
                <button 
                    onClick={onBack} 
                    className="bg-light-card dark:bg-brand-card hover:bg-gray-200 dark:hover:brightness-125 text-light-text dark:text-brand-text font-bold py-2 px-4 rounded-full transition-all duration-300 flex items-center shadow-md"
                    aria-label="Back to movie list"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-brand-primary" style={{ filter: 'drop-shadow(0 0 5px rgba(252, 71, 71, 0.5))' }} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Back
                </button>
                <button
                    onClick={onGoHome}
                    className="bg-light-card dark:bg-brand-card hover:bg-gray-200 dark:hover:brightness-125 text-light-text dark:text-brand-text font-bold py-2 px-4 rounded-full transition-all duration-300 flex items-center shadow-md"
                    aria-label="Go to Homepage"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-brand-primary" style={{ filter: 'drop-shadow(0 0 5px rgba(252, 71, 71, 0.5))' }} viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                    </svg>
                    Home
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
                {/* Left Column: Poster */}
                <div className="flex-shrink-0 w-full sm:w-2/3 md:w-80 mx-auto md:mx-0">
                <img 
                    src={movie.posterUrl} 
                    alt={`${movie.title} poster`} 
                    className="w-full h-auto aspect-[2/3] object-cover rounded-xl shadow-2xl"
                />
                </div>

                {/* Right Column: Details */}
                <div className="flex-grow">
                <EditableText
                    isLiveEditMode={isLiveEditMode}
                    initialText={movie.title}
                    onSave={(newText) => onUpdateField(movie.id, 'title', newText)}
                    tag="h1"
                    className="font-brand text-4xl md:text-5xl lg:text-6xl font-extrabold text-light-text dark:text-brand-text mb-2"
                />
                
                <EditableText
                    isLiveEditMode={isLiveEditMode}
                    initialText={movie.tagline || ''}
                    onSave={(newText) => onUpdateField(movie.id, 'tagline', newText)}
                    tag="p"
                    className="text-lg italic text-light-text-secondary dark:text-brand-text-secondary mb-4"
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                    {movie.rating && movie.rating > 0 && (
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-primary" style={{ filter: 'drop-shadow(0 0 6px #fc4747)' }} viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-xl font-bold">{movie.rating.toFixed(1)} / 10</span>
                        </div>
                    )}
                    {movie.releaseDate && <InfoPill icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" style={{ filter: 'drop-shadow(0 0 4px rgba(252, 71, 71, 0.6))' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>}>{new Date(movie.releaseDate).getFullYear()}</InfoPill>}
                    {movie.runtime && <InfoPill icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" style={{ filter: 'drop-shadow(0 0 4px rgba(252, 71, 71, 0.6))' }} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" /></svg>}>{formatRuntime(movie.runtime)}</InfoPill>}
                    {movie.category === 'webseries' && movie.seasons && movie.seasons.length > 0 && (
                        <InfoPill icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" style={{ filter: 'drop-shadow(0 0 4px rgba(252, 71, 71, 0.6))' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}>{`${movie.seasons.length} Seasons / ${getTotalEpisodes()} Episodes`}</InfoPill>
                    )}
                </div>

                {movie.genres && movie.genres.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        {movie.genres.map(genre => <GenrePill key={genre.id}>{genre.name}</GenrePill>)}
                    </div>
                )}
                
                <div className="mb-8 p-4 bg-light-card dark:bg-brand-card rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-light-text dark:text-brand-text mb-3">Story</h2>
                    <EditableText
                        isLiveEditMode={isLiveEditMode}
                        initialText={movie.description}
                        onSave={(newText) => onUpdateField(movie.id, 'description', newText)}
                        tag="p"
                        isTextarea={true}
                        className="text-lg text-light-text-secondary dark:text-brand-text-secondary leading-relaxed max-h-48 overflow-y-auto"
                        inputClassName="text-lg"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-light-text dark:text-brand-text">
                    <div>
                        <h3 className="text-sm font-semibold text-light-text-secondary dark:text-brand-text-secondary uppercase tracking-wider">Actors</h3>
                        <EditableText
                            isLiveEditMode={isLiveEditMode}
                            initialText={movie.actors}
                            onSave={(newText) => onUpdateField(movie.id, 'actors', newText)}
                            tag="p"
                            isTextarea={true}
                            className="text-lg"
                            inputClassName="text-lg"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-light-text-secondary dark:text-brand-text-secondary uppercase tracking-wider">Director</h3>
                        <EditableText
                            isLiveEditMode={isLiveEditMode}
                            initialText={movie.director}
                            onSave={(newText) => onUpdateField(movie.id, 'director', newText)}
                            tag="p"
                            className="text-lg"
                            inputClassName="text-lg"
                        />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-light-text-secondary dark:text-brand-text-secondary uppercase tracking-wider">Producer</h3>
                         <EditableText
                            isLiveEditMode={isLiveEditMode}
                            initialText={movie.producer}
                            onSave={(newText) => onUpdateField(movie.id, 'producer', newText)}
                            tag="p"
                            isTextarea={true}
                            className="text-lg"
                            inputClassName="text-lg"
                        />
                    </div>
                </div>

                {movie.trailerLink && (
                    <div className="mb-10">
                        <h2 className="text-2xl font-bold text-light-text dark:text-brand-text mb-4">Watch Trailer</h2>
                        <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-lg">
                            <iframe 
                                src={movie.trailerLink}
                                title={`${movie.title} Trailer`}
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                className="w-full h-full"
                            ></iframe>
                        </div>
                    </div>
                )}
                
                <div className="mb-12">
                {movie.category === 'webseries' && movie.seasons && movie.seasons.length > 0 ? (
                    <div>
                        <h2 className="text-3xl font-bold text-light-text dark:text-brand-text mb-4">Seasons & Episodes</h2>
                        <div className="space-y-6">
                            {movie.seasons.map(season => (
                                <div key={season.seasonNumber}>
                                    <h3 className="text-2xl font-bold text-brand-primary mb-3 [text-shadow:0_0_8px_theme(colors.brand-primary)]">Season {season.seasonNumber}</h3>
                                    
                                    {/* --- NEW: FULL SEASON FILES SECTION --- */}
                                    {season.fullSeasonFiles && season.fullSeasonFiles.length > 0 && (
                                      <div className="mb-4 grid gap-3 grid-cols-1 md:grid-cols-2">
                                        {season.fullSeasonFiles.map((file, fIdx) => (
                                          <div key={fIdx} className="bg-light-card dark:bg-brand-card p-4 rounded-lg border border-brand-primary/30 shadow-sm hover:shadow-md transition-shadow">
                                            <h4 className="font-bold text-lg text-light-text dark:text-brand-text mb-3 flex items-center gap-2">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                              {file.title || "Full Season File"}
                                            </h4>
                                            <div className="flex flex-col gap-2">
                                              {file.telegramLinks.map((link, lIdx) => (
                                                <a key={lIdx} href={`https://t.me/Hubb_for_You_1bot?start=${link.fileId}`} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold py-2 px-3 rounded transition-all transform hover:scale-[1.02]">
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23l7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3L3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.57c-.28 1.1-.86 1.32-1.7.82l-4.7-3.45l-2.4 2.3c-.27.27-.5.39-.83.39.35-.39.42-.64.48-.92z"/></svg>
                                                  <span>Telegram {link.quality}</span>
                                                </a>
                                              ))}
                                              {file.downloadLinks.map((link, lIdx) => (
                                                <a key={lIdx} href={link.url} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-3 rounded transition-all transform hover:scale-[1.02]">
                                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                  <span>Download {link.quality}</span>
                                                </a>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {season.episodes.map(episode => (
                                            <button 
                                                key={episode.episodeNumber}
                                                onClick={() => setSelectedEpisode(episode)}
                                                className="text-center p-3 bg-light-card dark:bg-brand-card rounded-lg shadow-md hover:bg-gray-200 dark:hover:brightness-125 transition-all duration-300 transform hover:scale-105 group"
                                            >
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-primary group-hover:scale-110 transition-transform" style={{ filter: 'drop-shadow(0 0 5px rgba(252, 71, 71, 0.5))' }} viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                    </svg>
                                                    <div>
                                                        <span className="font-bold text-lg text-light-text dark:text-brand-text">Ep {episode.episodeNumber}</span>
                                                        <p className="text-xs text-light-text-secondary dark:text-brand-text-secondary truncate mt-1">{episode.title}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-3xl font-bold text-light-text dark:text-brand-text mb-4">Actions</h2>
                        {hasTelegramLink || hasDirectLinks ? (
                            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                                {hasTelegramLink && movie.telegramLinks!.map((link, index) => (
                                    <a
                                        key={`tg-${index}`}
                                        href={`https://t.me/Hubb_for_You_1bot?start=${link.fileId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white text-xl font-bold py-4 px-10 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-[0_0_15px_rgba(56,189,248,0.6)]"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23l7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3L3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.57c-.28 1.1-.86 1.32-1.7.82l-4.7-3.45l-2.4 2.3c-.27.27-.5.39-.83.39.35-.39.42-.64.48-.92z"/></svg>
                                        <span>Telegram {link.quality}</span>
                                    </a>
                                ))}
                                {hasDirectLinks && movie.downloadLinks!.map((link, index) => (
                                    <a
                                        key={index}
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xl font-bold py-4 px-10 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-[0_0_15px_rgba(252,71,71,0.6)]"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                        <span>Download {link.quality}</span>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-3 bg-gray-400 dark:bg-gray-500 text-white text-xl font-bold py-4 px-10 rounded-lg cursor-not-allowed shadow-inner">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                                <span>Downloads Unavailable</span>
                            </div>
                        )}
                    </div>
                )}
                </div>

                {/* Feedback Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-12">
                    <h2 className="text-3xl font-bold text-center text-light-text dark:text-brand-text mb-4">Feedback & Reactions</h2>
                    <p className="text-center text-light-text-secondary dark:text-brand-text-secondary mb-8">How do you feel about this?</p>
                    <ReactionPanel movieId={movie._id} />
                    <CommentBox movieId={movie._id} movieTitle={movie.title} />
                </div>

                </div>
            </div>
        </div>
    </div>
    {selectedEpisode && <EpisodeDownloadsModal episode={selectedEpisode} onClose={() => setSelectedEpisode(null)} />}
    </>
  );
};

export default MovieDetails;
