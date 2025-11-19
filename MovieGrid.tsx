import React from 'react';
import { Movie } from '../types';
import MovieCard from './MovieCard';

interface MovieGridProps {
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  searchQuery: string;
  isLiveEditMode: boolean;
  onUpdateField: (movieId: string, field: keyof Movie, value: any) => void;
}

const MovieGrid: React.FC<MovieGridProps> = ({
  movies,
  onSelectMovie,
  searchQuery,
  isLiveEditMode,
  onUpdateField
}) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      {movies.length > 0 ? (
        movies.map((movie) => (
          <MovieCard
            key={movie._id || movie.id}   // ⭐ FIXED
            movie={movie}
            onSelectMovie={onSelectMovie}
            isLiveEditMode={isLiveEditMode}
            onUpdateField={onUpdateField}
          />
        ))
      ) : (
        <p className="col-span-full text-center text-light-text-secondary dark:text-brand-text-secondary">
          No results found for "{searchQuery}".
        </p>
      )}
    </div>
  );
};

export default MovieGrid;
