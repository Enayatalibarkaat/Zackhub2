export type MovieCategory = 'webseries' | 'hollywood' | 'bollywood' | 'south-indian';

export interface DownloadLink {
  quality: string;
  url: string;
}

export interface TelegramLink {
  quality: string;
  fileId: string;
}

export interface FullSeasonFile {
  title: string; // e.g. "Full Season 1" or "Part 1"
  telegramLinks: TelegramLink[];
  downloadLinks: DownloadLink[];
}

export interface Episode {
  episodeNumber: number;
  title: string;
  downloadLinks: DownloadLink[];
  telegramLinks?: TelegramLink[];
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
  fullSeasonFiles?: FullSeasonFile[]; // NEW ADDITION
}

export interface Genre {
  id: number;
  name: string;
}

export interface Movie {
  id: string;
  title: string;
  posterUrl: string;
  description: string;
  category: MovieCategory;
  actors: string;
  director: string;
  producer: string;
  rating?: number;
  downloadLinks?: DownloadLink[];
  telegramLinks?: TelegramLink[];
  seasons?: Season[];
  trailerLink?: string;
  genres?: Genre[];
  releaseDate?: string;
  runtime?: number; // in minutes
  tagline?: string;
  backdropUrl?: string;
}

// --- Admin & Permissions Types ---
export interface AdminPermissions {
  canAddContent: boolean;
  canEditContent: boolean;
  canDeleteContent: boolean;
  canManageComments: boolean;
  canLiveEdit: boolean;
}

export interface AdminUser {
  username: string;
  password: string;
  permissions: AdminPermissions;
}

export type CurrentUser = { username: 'Enayat78'; role: 'super' } | AdminUser;


// --- Comment Type ---
export interface Comment {
  id: string;
  name: string;
  text: string;
  timestamp: string;
  parentId: string | null;
}


// TMDB API Types
export interface TmdbSearchResult {
  id: number;
  title?: string; // For movies
  name?: string; // For TV shows
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  release_date?: string; // For movies
  first_air_date?: string; // For TV shows
}

export interface TmdbCast {
  name:string;
}

export interface TmdbCrew {
  name: string;
  job: string;
}

export interface TmdbCreditsResponse {
  cast: TmdbCast[];
  crew: TmdbCrew[];
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TmdbVideosResponse {
  results: TmdbVideo[];
}

export interface TmdbDetailResponse {
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  created_by?: { name: string }[];
  vote_average: number;
  genres: Genre[];
  release_date?: string; // For movies
  first_air_date?: string; // For TV
  runtime?: number; // For movies
  episode_run_time?: number[]; // For TV
  tagline?: string;
  backdrop_path?: string | null;
  credits: TmdbCreditsResponse;
  videos: TmdbVideosResponse;
}
