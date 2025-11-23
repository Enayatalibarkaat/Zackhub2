import React from 'react';
import { Movie } from '../types';
import MovieCard from './MovieCard';

interface MovieGridProps {
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  searchQuery: string;
  isLiveEditMode: boolean;
  onUpdateField: (movieId: string, field: keyof Movie, value: any) => void;
  isLoading?: boolean; // New prop for loading state
}

// --- SKELETON CARD (Loading Effect) ---
const SkeletonCard = () => (
  <div className="bg-light-card dark:bg-brand-card rounded-lg overflow-hidden shadow-md flex flex-col animate-pulse">
    {/* Poster Skeleton */}
    <div className="w-full aspect-[2/3] bg-gray-300 dark:bg-gray-700"></div>
    {/* Text Skeleton */}
    <div className="p-3 flex-grow flex flex-col justify-center gap-2">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
    </div>
  </div>
);

const MovieGrid: React.FC<MovieGridProps> = ({
  movies,
  onSelectMovie,
  searchQuery,
  isLiveEditMode,
  onUpdateField,
  isLoading = false // Default false
}) => {
  
  // Agar loading ho raha hai to 10 nakli cards dikhao
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
        {[...Array(10)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      {movies.length > 0 ? (
        movies.map((movie) => (
          <MovieCard
            key={movie._id || movie.id}
            movie={movie}
            onSelectMovie={onSelectMovie}
            isLiveEditMode={isLiveEditMode}
            onUpdateField={onUpdateField}
          />
        ))
      ) : (
        <p className="col-span-full text-center text-light-text-secondary dark:text-brand-text-secondary py-10 text-lg">
          No results found for "{searchQuery}".
        </p>
      )}
    </div>
  );
};

export default MovieGrid;
