import React, { useState } from 'react';
import { Movie } from '../types';
import EditableText from './EditableText';

interface MovieCardProps {
  movie: Movie;
  onSelectMovie: (movie: Movie) => void;
  isLiveEditMode: boolean;
  onUpdateField: (movieId: string, field: keyof Movie, value: any) => void;
}

const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onSelectMovie,
  isLiveEditMode,
  onUpdateField
}) => {
  const [showRecommendationNote, setShowRecommendationNote] = useState(false);

  // SAFE fallback values
  const poster =
    movie?.posterUrl && movie.posterUrl !== ""
      ? movie.posterUrl
      : "https://placehold.co/300x450?text=No+Image";

  const safeRating =
    typeof movie?.rating === "number"
      ? movie.rating.toFixed(1)
      : "0.0";

  // MongoDB uses _id, not id
  const movieId = movie?._id || movie?.id || "";

  return (
    <div
      className="bg-light-card dark:bg-brand-card rounded-lg overflow-hidden shadow-md hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group flex flex-col relative"
      onClick={() => onSelectMovie({ ...movie, id: movieId })}
    >
      <div className="relative">
        <img
          src={poster}
          alt={movie.title}
          className="w-full h-auto aspect-[2/3] object-cover"
        />

        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-10 dark:bg-opacity-40 dark:group-hover:bg-opacity-20 transition-all duration-300"></div>

        {/* --- Season Label --- */}
        {movie?.category === "webseries" &&
          movie?.seasons &&
          movie.seasons.length > 0 && (
            <div className="absolute bottom-2 left-2 bg-brand-primary text-white text-xs font-bold px-2 py-1 rounded shadow">
              {`${movie.seasons.length} Season${movie.seasons.length > 1 ? "s" : ""}`}
            </div>
          )}

        {/* --- Rating Label --- */}
        {movie?.rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.603 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{safeRating}</span>
          </div>
        )}
      </div>

      {/* --- NEW: Recommended Badge (Red Bookmark) --- */}
      {movie.isRecommended && (
        <div className="absolute top-0 left-2 z-10">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowRecommendationNote(true);
              window.setTimeout(() => setShowRecommendationNote(false), 2000);
            }}
            className="relative flex items-start"
            aria-label="Recommended by admin"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-8 h-10 text-red-600 drop-shadow-lg"
            >
              <path
                fillRule="evenodd"
                d="M6.32 2.577a49.255 49.255 0 0111.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 01-1.085.67L12 18.089l-7.165 3.583A.75.75 0 013.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93z"
                clipRule="evenodd"
              />
            </svg>
            <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-red-600 shadow">
              i
            </span>
            {showRecommendationNote && (
              <span className="absolute top-full left-0 mt-1 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold text-white shadow">
                Recommended by admin
              </span>
            )}
          </button>
        </div>
      )}

      <div className="p-3 flex-grow flex flex-col justify-center">
        <EditableText
          isLiveEditMode={isLiveEditMode}
          initialText={movie.title}
          onSave={(newText) => onUpdateField(movieId, "title", newText)}
          tag="h3"
          className="font-brand font-bold text-base text-light-text dark:text-brand-text group-hover:text-light-primary dark:group-hover:text-brand-primary transition-colors duration-300"
        />
      </div>
    </div>
  );
};

export default MovieCard;
