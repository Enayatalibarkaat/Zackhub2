import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Movie,
  MovieCategory,
  DownloadLink,
  Season,
  Episode,
  AdminUser,
  CurrentUser,
  AdminPermissions,
  Comment as CommentType,
  TelegramLink,
  TmdbSearchResult,
  TmdbDetailResponse,
} from "./types";
import {
  getAllCommentsFromStorage,
  deleteCommentFromStorage,
  getAdmins,
  addAdmin,
  removeAdmin,
  updateAdminPermissions,
} from "./utils";

/**
 * AdminPanel
 * -----------
 * LocalStorage hataya gaya. Ye panel ab Netlify Functions + MongoDB ko call karta hai:
 * - GET    /.netlify/functions/getMovies      -> { movies: Movie[] }
 * - POST   /.netlify/functions/addMovie       -> body: Movie (without id)
 * - POST   /.netlify/functions/updateMovie    -> body: { id, ...fieldsToUpdate }
 * - POST   /.netlify/functions/deleteMovie    -> body: { id }
 *
 * Har mutation ke baad list DB se refetch hoti hai (dusre phones par bhi latest dikhne ke liye).
 * TMDB autofill preserved hai: search -> select -> form fill -> Save -> DB.
 */

interface AdminPanelProps {
  movies: Movie[];
  setMovies: React.Dispatch<React.SetStateAction<Movie[]>>;
  onLogout: () => void;
  currentUser: CurrentUser | null;
}

/** ---------- Config ---------- */
const TMDB_API_KEY = "2a2a62df397f68c9119a58e3a084e496";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

/** ---------- Helpers ---------- */
const initialFormState: Omit<Movie, "id"> = {
  title: "",
  posterUrl: "",
  description: "",
  category: "hollywood",
  actors: "",
  director: "",
  producer: "",
  rating: 0,
  downloadLinks: [],
  telegramLinks: [],
  seasons: [],
  trailerLink: "",
  genres: [],
  releaseDate: "",
  runtime: 0,
  tagline: "",
  backdropUrl: "",
};

const ytEmbed = (videoId: string) =>
  videoId ? `https://www.youtube.com/embed/${videoId}` : "";

/** ---------- Permissions Toggle (UI) ---------- */
const PermissionToggle: React.FC<{
  label: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}> = ({ label, isChecked, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-light-bg dark:bg-brand-bg rounded-md">
    <span className="font-medium text-light-text dark:text-brand-text">
      {label}
    </span>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
    </label>
  </div>
);

/** ---------- Component ---------- */
const AdminPanel: React.FC<AdminPanelProps> = ({
  movies,
  setMovies,
  onLogout,
  currentUser,
}) => {
  // Form / Edit
  const [formState, setFormState] = useState<Omit<Movie, "id">>(initialFormState);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);

  // Manage list (search/select to edit)
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [selectedManagedMovie, setSelectedManagedMovie] = useState<Movie | null>(null);

  // TMDB
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbSearchResult[]>([]);
  const [isTmdbLoading, setIsTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);

  // Comments
  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false);
  const [allComments, setAllComments] = useState<
    (CommentType & { movieId: string; movieTitle: string })[]
  >([]);
  const [commentSearch, setCommentSearch] = useState("");
  const [searchedUsername, setSearchedUsername] = useState("");
  const [filteredComments, setFilteredComments] = useState<
    (CommentType & { movieId: string; movieTitle: string })[]
  >([]);
  const [adminReplyingTo, setAdminReplyingTo] = useState<
    (CommentType & { movieId: string; movieTitle: string }) | null
  >(null);
  const [adminReplyText, setAdminReplyText] = useState("");

  // Admins
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");
  const [editingPermissionsFor, setEditingPermissionsFor] =
    useState<AdminUser | null>(null);
  const [tempPermissions, setTempPermissions] =
    useState<AdminPermissions | null>(null);

  // UI helpers
  const isSuperAdmin = currentUser?.role === "super";
  const stats = useMemo(
    () => ({
      total: movies.length,
      hollywood: movies.filter((m) => m.category === "hollywood").length,
      bollywood: movies.filter((m) => m.category === "bollywood").length,
      "south-indian": movies.filter((m) => m.category === "south-indian").length,
      webseries: movies.filter((m) => m.category === "webseries").length,
    }),
    [movies]
  );

  const hasPermission = useCallback(
    (permission: keyof AdminPermissions) => {
      if (isSuperAdmin) return true;
      if (currentUser && "permissions" in currentUser) {
        return !!currentUser.permissions[permission];
      }
      return false;
    },
    [currentUser, isSuperAdmin]
  );

  /** ---------------- DB Sync ---------------- */

  /** Normalize docs: map `_id` to `id` for React. */
  const normalizeMovies = (list: any[]): Movie[] => {
    return (list || []).map((m: any) => ({
      id: String(m.id || m._id), // prefer id if backend already provides
      title: m.title || "",
      posterUrl: m.posterUrl || "",
      description: m.description || "",
      category: m.category as MovieCategory,
      actors: m.actors || "",
      director: m.director || "",
      producer: m.producer || "",
      rating: Number(m.rating || 0),
      downloadLinks: m.downloadLinks || [],
      telegramLinks: m.telegramLinks || [],
      seasons: m.seasons || [],
      trailerLink: m.trailerLink || "",
      genres: m.genres || [],
      releaseDate: m.releaseDate || "",
      runtime: Number(m.runtime || 0),
      tagline: m.tagline || "",
      backdropUrl: m.backdropUrl || "",
    }));
  };

  /** Fetch all movies from the DB (Netlify Function). */
  const fetchMovies = useCallback(async () => {
    try {
      const res = await fetch("/.netlify/functions/getMovies");
      const data = await res.json();
      const list = normalizeMovies(data?.movies || []);
      setMovies(list);
    } catch (err) {
      console.error("Failed to load movies from DB:", err);
    }
  }, [setMovies]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  /** ---------------- Admins (local storage based as before) ---------------- */
  useEffect(() => {
    if (isSuperAdmin) setAdmins(getAdmins());
  }, [isSuperAdmin]);

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFormError("");
    setAdminFormSuccess("");

    if (!newAdminUsername.trim() || !newAdminPassword.trim()) {
      setAdminFormError("Username and password cannot be empty.");
      return;
    }

    const result = addAdmin({
      username: newAdminUsername.trim(),
      password: newAdminPassword.trim(),
    });
    if (result.success) {
      setAdmins(getAdmins());
      setNewAdminUsername("");
      setNewAdminPassword("");
      setAdminFormSuccess(result.message);
    } else {
      setAdminFormError(result.message);
    }
  };

  const handleRemoveAdmin = (username: string) => {
    if (
      window.confirm(
        `Are you sure you want to remove the admin "${username}"? They will no longer be able to log in.`
      )
    ) {
      if (removeAdmin(username)) {
        setAdmins((prev) => prev.filter((a) => a.username !== username));
      } else {
        alert("Failed to remove admin.");
      }
    }
  };

  const handleOpenPermissionsModal = (admin: AdminUser) => {
    setEditingPermissionsFor(admin);
    setTempPermissions(admin.permissions);
  };
  const handleSavePermissions = () => {
    if (editingPermissionsFor && tempPermissions) {
      if (updateAdminPermissions(editingPermissionsFor.username, tempPermissions)) {
        setAdmins(getAdmins());
        setEditingPermissionsFor(null);
        setTempPermissions(null);
      } else {
        alert("Failed to save permissions.");
      }
    }
  };

  /** ---------------- Comments (local) ---------------- */
  const movieMap = useMemo(() => new Map(movies.map((m) => [m.id, m.title])), [movies]);
  const loadAllComments = async () => {
  try {
    const res = await fetch('/.netlify/functions/getComments?movieId=all');
    const data = await res.json();

    if (data.success && data.comments) {
      // Match movie titles with IDs
      const commentsWithTitles = data.comments.map((c) => ({
        ...c,
        movieTitle: movieMap.get(c.movieId) || "Unknown Movie",
      }));
      setAllComments(commentsWithTitles);
    } else {
      console.error('Error loading comments:', data.message);
    }
  } catch (err) {
    console.error('Failed to fetch comments:', err);
  }
};
  useEffect(() => {
    loadAllComments();
  }, [movies, movieMap]);

  const handleCommentSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchedUsername(commentSearch);
    if (!commentSearch.trim()) {
      setFilteredComments([]);
      return;
    }
    const results = allComments.filter(
      (c) => c.name.toLowerCase() === commentSearch.trim().toLowerCase()
    );
    setFilteredComments(results);
  };

  const handleAdminReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !adminReplyingTo) return;
    const newReply: CommentType = {
      id: new Date().toISOString(),
      name: "Admin",
      text: adminReplyText.trim(),
      timestamp: new Date().toISOString(),
      parentId: adminReplyingTo.id,
    };
    const storageKey = `zackhub-comments-${adminReplyingTo.movieId}`;
    try {
      const existing: CommentType[] = JSON.parse(
        localStorage.getItem(storageKey) || "[]"
      );
      const updated = [...existing, newReply];
      localStorage.setItem(storageKey, JSON.stringify(updated));
      loadAllComments();
      if (filteredComments.length > 0) {
        const results = getAllCommentsFromStorage()
          .map((c) => ({ ...c, movieTitle: movieMap.get(c.movieId) || "Unknown Movie" }))
          .filter(
            (c) => c.name.toLowerCase() === commentSearch.trim().toLowerCase()
          );
        setFilteredComments(results);
      }
    } catch (err) {
      console.error("Failed to save admin reply:", err);
    }
    setAdminReplyText("");
    setAdminReplyingTo(null);
  };

  const handleDeleteComment = async (comment: any) => {
  if (!window.confirm("Are you sure you want to delete this comment?")) return;

  try {
    const res = await fetch('/.netlify/functions/deleteComment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: comment.id || comment._id }),
    });

    const data = await res.json();

    if (data.success) {
      alert('Comment deleted ✅');
      loadAllComments(); // refresh admin panel
    } else {
      alert(data.message || 'Failed to delete ❌');
    }
  } catch (err) {
    console.error('Failed to delete comment:', err);
    alert('Server error ❌');
  }
};

  /** ---------------- Form helpers ---------------- */
  const isEditing = editingMovieId !== null;
  const resetForm = () => {
    setFormState(initialFormState);
    setEditingMovieId(null);
    setSelectedManagedMovie(null);
  };

  const handleStartEdit = (movie: Movie) => {
    setEditingMovieId(movie.id);
    setFormState({
      title: movie.title || "",
      posterUrl: movie.posterUrl || "",
      description: movie.description || "",
      category: movie.category,
      actors: movie.actors || "",
      director: movie.director || "",
      producer: movie.producer || "",
      rating: movie.rating || 0,
      downloadLinks: movie.downloadLinks || [],
      telegramLinks: movie.telegramLinks || [],
      seasons: movie.seasons || [],
      trailerLink: movie.trailerLink || "",
      genres: movie.genres || [],
      releaseDate: movie.releaseDate || "",
      runtime: movie.runtime || 0,
      tagline: movie.tagline || "",
      backdropUrl: movie.backdropUrl || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleDownloadLinkChange = (
    index: number,
    field: keyof DownloadLink,
    value: string
  ) => {
    const updated = formState.downloadLinks ? [...formState.downloadLinks] : [];
    if (!updated[index]) updated[index] = { quality: "", url: "" };
    updated[index][field] = value;
    setFormState((p) => ({ ...p, downloadLinks: updated }));
  };
  const addDownloadLink = () =>
    setFormState((p) => ({
      ...p,
      downloadLinks: [...(p.downloadLinks || []), { quality: "", url: "" }],
    }));
  const removeDownloadLink = (index: number) =>
    setFormState((p) => ({
      ...p,
      downloadLinks: (p.downloadLinks || []).filter((_, i) => i !== index),
    }));

  const handleTelegramLinkChange = (
    index: number,
    field: keyof TelegramLink,
    value: string
  ) => {
    const updated = formState.telegramLinks ? [...formState.telegramLinks] : [];
    if (!updated[index]) updated[index] = { quality: "", fileId: "" };
    updated[index][field] = value;
    setFormState((p) => ({ ...p, telegramLinks: updated }));
  };
  const addTelegramLink = () =>
    setFormState((p) => ({
      ...p,
      telegramLinks: [...(p.telegramLinks || []), { quality: "", fileId: "" }],
    }));
  const removeTelegramLink = (index: number) =>
    setFormState((p) => ({
      ...p,
      telegramLinks: (p.telegramLinks || []).filter((_, i) => i !== index),
    }));

  const addSeason = () => {
    const newSeasonNumber = formState.seasons ? formState.seasons.length + 1 : 1;
    const newSeason: Season = { seasonNumber: newSeasonNumber, episodes: [] };
    setFormState((p) => ({ ...p, seasons: [...(p.seasons || []), newSeason] }));
  };
  const removeSeason = (seasonIndex: number) => {
    setFormState((p) => ({
      ...p,
      seasons: (p.seasons || []).filter((_, i) => i !== seasonIndex),
    }));
  };

  const addEpisode = (seasonIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    const newEpisode: Episode = {
      episodeNumber: (newSeasons[seasonIndex]?.episodes?.length || 0) + 1,
      title: "",
      downloadLinks: [],
      telegramLinks: [],
    };
    newSeasons[seasonIndex].episodes.push(newEpisode);
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const removeEpisode = (seasonIndex: number, episodeIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes = newSeasons[seasonIndex].episodes.filter(
      (_: any, i: number) => i !== episodeIndex
    );
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const handleEpisodeChange = (
    seasonIndex: number,
    episodeIndex: number,
    field: keyof Omit<Episode, "downloadLinks" | "episodeNumber" | "telegramLinks">,
    value: string
  ) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex][field] = value;
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const addEpisodeDownloadLink = (seasonIndex: number, episodeIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks.push({
      quality: "",
      url: "",
    });
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const removeEpisodeDownloadLink = (
    seasonIndex: number,
    episodeIndex: number,
    linkIndex: number
  ) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks =
      newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks.filter(
        (_: any, i: number) => i !== linkIndex
      );
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const handleEpisodeDownloadLinkChange = (
    seasonIndex: number,
    episodeIndex: number,
    linkIndex: number,
    field: keyof DownloadLink,
    value: string
  ) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks[linkIndex][field] =
      value;
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };

  const addEpisodeTelegramLink = (seasonIndex: number, episodeIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    if (!newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks) {
      newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks = [];
    }
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks.push({
      quality: "",
      fileId: "",
    });
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const removeEpisodeTelegramLink = (
    seasonIndex: number,
    episodeIndex: number,
    linkIndex: number
  ) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks =
      newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks.filter(
        (_: any, i: number) => i !== linkIndex
      );
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const handleEpisodeTelegramLinkChange = (
    seasonIndex: number,
    episodeIndex: number,
    linkIndex: number,
    field: keyof TelegramLink,
    value: string
  ) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks[linkIndex][field] =
      value;
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };

  /** ---------------- TMDB ---------------- */
  const handleTmdbSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tmdbSearchQuery.trim()) return;
    setIsTmdbLoading(true);
    setTmdbError(null);
    try {
      const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(
        tmdbSearchQuery.trim()
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      // ✅ Only show Movies & TV/Webseries results
const filtered = (data?.results || []).filter(
  (item: any) => item.media_type === "movie" || item.media_type === "tv"
);

setTmdbResults(filtered as TmdbSearchResult[]);
    } catch (err: any) {
      setTmdbError("TMDB search failed");
      console.error(err);
    } finally {
      setIsTmdbLoading(false);
    }
  };

  const handleSelectTmdb = async (item: TmdbSearchResult) => {
    try {
      const isMovie = item.media_type === "movie";
      const detailUrl = `${TMDB_BASE_URL}/${isMovie ? "movie" : "tv"}/${item.id}?api_key=${TMDB_API_KEY}&append_to_response=videos,credits`;
      const res = await fetch(detailUrl);
      const detail: TmdbDetailResponse = await res.json();
      const poster = detail.poster_path
        ? `${TMDB_IMAGE_BASE_URL}w500${detail.poster_path}`
        : "";
      const backdrop = detail.backdrop_path
        ? `${TMDB_IMAGE_BASE_URL}w1280${detail.backdrop_path}`
        : "";
      const trailerKey =
        detail.videos?.results?.find((v: any) => v.type === "Trailer")?.key || "";

      setFormState((p) => ({
        ...p,
    title: (detail as any).title || (detail as any).name || "",
        description: detail.overview || "",
        posterUrl: poster,
        backdropUrl: backdrop,
        tagline: (detail as any).tagline || "",
        releaseDate: (detail as any).release_date || (detail as any).first_air_date || "",
        runtime: Number((detail as any).runtime || 0),
        trailerLink: ytEmbed(trailerKey),
        genres: (detail.genres || []).map((g: any) => ({ id: g.id, name: g.name })),
        actors: (detail.credits?.cast || []).slice(0, 5).map((p: any) => p.name).join(", "),
        director: (detail.credits?.crew || []).find((p: any) => p.job === "Director")?.name || "",
        producer: (detail.credits?.crew || []).find((p: any) => p.job === "Producer")?.name || "",
        rating: detail.vote_average || 0,
      }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("TMDB detail fetch failed:", err);
    }
  };

  /** ---------------- CRUD (DB) ---------------- */

  const saveNewMovie = async () => {
    const payload = {
      ...formState,
      rating: Number(formState.rating) || 0,
      runtime: Number(formState.runtime) || 0,
      category: formState.category as MovieCategory,
    };
    const res = await fetch("/.netlify/functions/addMovie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Add movie failed");
  };

  const updateMovie = async (id: string) => {
    const payload = {
      id,
      ...{
        ...formState,
        rating: Number(formState.rating) || 0,
        runtime: Number(formState.runtime) || 0,
        category: formState.category as MovieCategory,
      },
    };
    const res = await fetch("/.netlify/functions/updateMovie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Update movie failed");
  };

  const deleteMovie = async (id: string) => {
    const res = await fetch("/.netlify/functions/deleteMovie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Delete movie failed");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovieId) {
        await updateMovie(editingMovieId);
      } else {
        await saveNewMovie();
      }
      await fetchMovies();
      resetForm();
      alert("Saved successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Save failed");
    }
  };

  const handleDeleteMovie = async (movie: Movie) => {
    if (!hasPermission("canDeleteMovies")) {
      alert("You don't have permission to delete.");
      return;
    }
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) return;
    try {
      await deleteMovie(movie.id);
      await fetchMovies();
      alert("Deleted.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Delete failed");
    }
  };

  /** ---------------- UI ---------------- */
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (sidebarRef.current) {
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 400;
      const maxWidth = window.innerWidth * 0.98;
      const clamped = Math.max(minWidth, Math.min(newWidth, maxWidth));
      sidebarRef.current.style.width = `${clamped}px`;
    }
  }, []);
  const handleMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "";
  }, [handleMouseMove]);
  const handleMouseDownOnResize = (e: React.MouseEvent) => {
    e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.userSelect = "none";
  };
  useEffect(() => () => handleMouseUp(), [handleMouseUp]);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <button
          className="px-4 py-2 rounded bg-red-500 text-white"
          onClick={onLogout}
        >
          Logout
        </button>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="p-4 rounded border dark:border-gray-700">
            <div className="text-sm opacity-70">{k}</div>
            <div className="text-xl font-semibold">{v}</div>
          </div>
        ))}
      </section>

      {/* Form */}
      <section className="bg-light-card dark:bg-brand-card border dark:border-gray-700 rounded-lg p-4 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          {isEditing ? "Edit Movie / Series" : "Add Movie / Series"}
        </h2>

        {/* TMDB Search */}
        <form onSubmit={handleTmdbSearch} className="mb-4 flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded border dark:border-gray-700"
            placeholder="Search TMDB (movie or TV name)"
            value={tmdbSearchQuery}
            onChange={(e) => setTmdbSearchQuery(e.target.value)}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white"
            disabled={isTmdbLoading}
          >
            {isTmdbLoading ? "Searching..." : "Search"}
          </button>
        </form>
        {tmdbError && <p className="text-red-600 mb-3">{tmdbError}</p>}
        {tmdbResults.length > 0 && (
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tmdbResults.map((r) => (
              <button
                key={`${r.media_type}-${r.id}`}
                onClick={() => handleSelectTmdb(r)}
                className="text-left p-3 border rounded hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="font-medium">{("title" in r && (r as any).title) || (r as any).name}</div>
                <div className="text-xs opacity-70">{r.media_type}</div>
              </button>
            ))}
          </div>
        )}

        {/* Main form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm opacity-70">Title</span>
              <input
                name="title"
                value={formState.title}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Category</span>
              <select
                name="category"
                value={formState.category}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
              >
                <option value="hollywood">Hollywood</option>
                <option value="bollywood">Bollywood</option>
                <option value="south-indian">South Indian</option>
                <option value="webseries">Webseries</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Description</span>
              <textarea
                name="description"
                value={formState.description}
                onChange={handleInputChange}
                rows={5}
                className="px-3 py-2 rounded border dark:border-gray-700"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Rating</span>
                <input
                  type="number"
                  step="0.1"
                  name="rating"
                  value={formState.rating}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded border dark:border-gray-700"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Runtime (min)</span>
                <input
                  type="number"
                  name="runtime"
                  value={formState.runtime}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded border dark:border-gray-700"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Release Date</span>
                <input
                  name="releaseDate"
                  value={formState.releaseDate}
                  onChange={handleInputChange}
                  placeholder="YYYY-MM-DD"
                  className="px-3 py-2 rounded border dark:border-gray-700"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Trailer (YouTube Embed)</span>
                <input
                  name="trailerLink"
                  value={formState.trailerLink}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded border dark:border-gray-700"
                  placeholder="https://www.youtube.com/embed/..."
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Poster URL</span>
              <input
                name="posterUrl"
                value={formState.posterUrl}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Backdrop URL</span>
              <input
                name="backdropUrl"
                value={formState.backdropUrl}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Actors</span>
                <input
                  name="actors"
                  value={formState.actors}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded border dark:border-gray-700"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm opacity-70">Director</span>
                <input
                  name="director"
                  value={formState.director}
                  onChange={handleInputChange}
                  className="px-3 py-2 rounded border dark:border-gray-700"
                />
              </label>
            </div>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Producer</span>
              <input
                name="producer"
                value={formState.producer}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm opacity-70">Tagline</span>
              <input
                name="tagline"
                value={formState.tagline}
                onChange={handleInputChange}
                className="px-3 py-2 rounded border dark:border-gray-700"
              />
            </label>
          </div>

          {/* Links & Seasons */}
          <div className="grid gap-3">
            {/* Genres note */}
            <p className="text-sm opacity-70">
              Genres TMDB selection se aa jayenge. Zarurat ho to baad me edit kar sakte ho.
            </p>

            {/* Download Links */}
            <div className="p-3 rounded border dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Download Links</h3>
                <button
                  type="button"
                  onClick={addDownloadLink}
                  className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
                >
                  + Add Link
                </button>
              </div>
              <div className="grid gap-2">
                {(formState.downloadLinks || []).map((link, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input
                      placeholder="Quality (720p/1080p)"
                      value={link.quality}
                      onChange={(e) =>
                        handleDownloadLinkChange(idx, "quality", e.target.value)
                      }
                      className="col-span-2 px-3 py-2 rounded border dark:border-gray-700"
                    />
                    <input
                      placeholder="URL"
                      value={link.url}
                      onChange={(e) =>
                        handleDownloadLinkChange(idx, "url", e.target.value)
                      }
                      className="col-span-3 px-3 py-2 rounded border dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeDownloadLink(idx)}
                      className="text-sm col-span-5 text-left text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Telegram Links */}
            <div className="p-3 rounded border dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Telegram Links</h3>
                <button
                  type="button"
                  onClick={addTelegramLink}
                  className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
                >
                  + Add Link
                </button>
              </div>
              <div className="grid gap-2">
                {(formState.telegramLinks || []).map((link, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-2">
                    <input
                      placeholder="Quality (720p/1080p)"
                      value={link.quality}
                      onChange={(e) =>
                        handleTelegramLinkChange(idx, "quality", e.target.value)
                      }
                      className="col-span-2 px-3 py-2 rounded border dark:border-gray-700"
                    />
                    <input
                      placeholder="Telegram fileId"
                      value={link.fileId}
                      onChange={(e) =>
                        handleTelegramLinkChange(idx, "fileId", e.target.value)
                      }
                      className="col-span-3 px-3 py-2 rounded border dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeTelegramLink(idx)}
                      className="text-sm col-span-5 text-left text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Seasons */}
            <div className="p-3 rounded border dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Seasons (for Webseries)</h3>
                <button
                  type="button"
                  onClick={addSeason}
                  className="text-sm px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
                >
                  + Add Season
                </button>
              </div>
              <div className="grid gap-3">
                {(formState.seasons || []).map((season, sIdx) => (
                  <div key={sIdx} className="p-2 border rounded dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">Season {season.seasonNumber}</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => addEpisode(sIdx)}
                          className="text-sm px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
                        >
                          + Episode
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSeason(sIdx)}
                          className="text-sm px-2 py-1 rounded bg-red-600 text-white"
                        >
                          Remove Season
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      {season.episodes.map((ep, eIdx) => (
                        <div key={eIdx} className="p-2 rounded border dark:border-gray-700">
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              placeholder="Episode title"
                              value={ep.title}
                              onChange={(e) =>
                                handleEpisodeChange(sIdx, eIdx, "title", e.target.value)
                              }
                              className="px-3 py-2 rounded border dark:border-gray-700 col-span-2"
                            />
                            <div className="text-sm opacity-60 self-center">
                              Ep #{ep.episodeNumber}
                            </div>
                          </div>

                          {/* Episode download links */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-sm">Download Links</div>
                              <button
                                type="button"
                                onClick={() => addEpisodeDownloadLink(sIdx, eIdx)}
                                className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
                              >
                                + Add
                              </button>
                            </div>
                            <div className="grid gap-2">
                              {(ep.downloadLinks || []).map((dl, dlIdx) => (
                                <div key={dlIdx} className="grid grid-cols-5 gap-2">
                                  <input
                                    placeholder="Quality"
                                    value={dl.quality}
                                    onChange={(e) =>
                                      handleEpisodeDownloadLinkChange(
                                        sIdx,
                                        eIdx,
                                        dlIdx,
                                        "quality",
                                        e.target.value
                                      )
                                    }
                                    className="col-span-2 px-3 py-2 rounded border dark:border-gray-700"
                                  />
                                  <input
                                    placeholder="URL"
                                    value={dl.url}
                                    onChange={(e) =>
                                      handleEpisodeDownloadLinkChange(
                                        sIdx,
                                        eIdx,
                                        dlIdx,
                                        "url",
                                        e.target.value
                                      )
                                    }
                                    className="col-span-3 px-3 py-2 rounded border dark:border-gray-700"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeEpisodeDownloadLink(sIdx, eIdx, dlIdx)
                                    }
                                    className="text-xs col-span-5 text-left text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Episode telegram links */}
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-sm">Telegram Links</div>
                              <button
                                type="button"
                                onClick={() => addEpisodeTelegramLink(sIdx, eIdx)}
                                className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
                              >
                                + Add
                              </button>
                            </div>
                            <div className="grid gap-2">
                              {(ep.telegramLinks || []).map((tl, tlIdx) => (
                                <div key={tlIdx} className="grid grid-cols-5 gap-2">
                                  <input
                                    placeholder="Quality"
                                    value={tl.quality}
                                    onChange={(e) =>
                                      handleEpisodeTelegramLinkChange(
                                        sIdx,
                                        eIdx,
                                        tlIdx,
                                        "quality",
                                        e.target.value
                                      )
                                    }
                                    className="col-span-2 px-3 py-2 rounded border dark:border-gray-700"
                                  />
                                  <input
                                    placeholder="fileId"
                                    value={tl.fileId}
                                    onChange={(e) =>
                                      handleEpisodeTelegramLinkChange(
                                        sIdx,
                                        eIdx,
                                        tlIdx,
                                        "fileId",
                                        e.target.value
                                      )
                                    }
                                    className="col-span-3 px-3 py-2 rounded border dark:border-gray-700"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeEpisodeTelegramLink(sIdx, eIdx, tlIdx)
                                    }
                                    className="text-xs col-span-5 text-left text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => removeEpisode(sIdx, eIdx)}
                              className="text-xs px-2 py-1 rounded bg-red-600 text-white"
                            >
                              Remove Episode
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-green-600 text-white"
              >
                {isEditing ? "Update" : "Add"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded bg-gray-300 dark:bg-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </section>

      {/* Manage Existing */}
      <section className="bg-light-card dark:bg-brand-card border dark:border-gray-700 rounded-lg p-4 mb-8">
        <h2 className="text-lg font-semibold mb-3">Manage Content</h2>
        <div className="mb-3">
          <input
            className="w-full px-3 py-2 rounded border dark:border-gray-700"
            placeholder="Search in your DB list..."
            value={manageSearchQuery}
            onChange={(e) => setManageSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid gap-2 max-h-[400px] overflow-auto">
          {movies
            .filter((m) =>
              m.title.toLowerCase().includes(manageSearchQuery.toLowerCase())
            )
            .map((m) => (
              <div
                key={m.id}
                className="p-3 rounded border dark:border-gray-700 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.title}</div>
                  <div className="text-xs opacity-70">{m.category}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-blue-600 text-white"
                    onClick={() => handleStartEdit(m)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white"
                    onClick={() => handleDeleteMovie(m)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Comments Sidebar Trigger */}
      <section className="bg-light-card dark:bg-brand-card border dark:border-gray-700 rounded-lg p-4 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comments</h2>
          <button
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
            onClick={() => setIsCommentSidebarOpen(true)}
          >
            Open
          </button>
        </div>
      </section>

      {/* Comments Drawer */}
      {isCommentSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsCommentSidebarOpen(false)}
        >
          <div
            ref={sidebarRef}
            className="absolute right-0 top-0 bottom-0 w-[520px] max-w-[96vw] bg-white dark:bg-gray-900 p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="absolute left-0 top-0 w-1 h-full cursor-col-resize"
              onMouseDown={handleMouseDownOnResize}
              title="Drag to resize"
            />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Manage Comments</h3>
              <button
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
                onClick={() => setIsCommentSidebarOpen(false)}
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCommentSearch} className="flex gap-2 mb-3">
              <input
                className="flex-1 px-3 py-2 rounded border dark:border-gray-700"
                placeholder="Search by username"
                value={commentSearch}
                onChange={(e) => setCommentSearch(e.target.value)}
              />
              <button type="submit" className="px-3 py-2 rounded bg-blue-600 text-white">
                Search
              </button>
            </form>

            {(filteredComments.length > 0 ? filteredComments : allComments).map(
              (c) => (
                <div
                  key={c.id}
                  className="p-3 mb-2 rounded border dark:border-gray-700"
                >
                  <div className="text-sm opacity-70">
             {c.username || "Unknown User"} • {c.createdAt ? new Date(c.createdAt).toLocaleString() : "Unknown Time"}
                  </div>
                  <div className="font-medium">{c.movieTitle}</div>
                  <div className="mt-1">{c.text}</div>

                  <div className="flex gap-2 mt-2">
                    <button
                      className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-sm"
                      onClick={() => setAdminReplyingTo(c)}
                    >
                      Reply
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-red-600 text-white text-sm"
                      onClick={() => handleDeleteComment(c)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            )}

            {adminReplyingTo && (
              <form onSubmit={handleAdminReplySubmit} className="mt-3 grid gap-2">
                <textarea
                  className="px-3 py-2 rounded border dark:border-gray-700"
                  placeholder="Write a reply..."
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-3 py-2 rounded bg-green-600 text-white"
                  >
                    Send Reply
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded bg-gray-300 dark:bg-gray-700"
                    onClick={() => {
                      setAdminReplyText("");
                      setAdminReplyingTo(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Admins (super only) */}
      {isSuperAdmin && (
        <section className="bg-light-card dark:bg-brand-card border dark:border-gray-700 rounded-lg p-4 mb-8">
          <h2 className="text-lg font-semibold mb-3">Admins</h2>

          <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
            <input
              className="px-3 py-2 rounded border dark:border-gray-700"
              placeholder="Username"
              value={newAdminUsername}
              onChange={(e) => setNewAdminUsername(e.target.value)}
            />
            <input
              className="px-3 py-2 rounded border dark:border-gray-700"
              placeholder="Password"
              value={newAdminPassword}
              onChange={(e) => setNewAdminPassword(e.target.value)}
            />
            <button className="px-3 py-2 rounded bg-blue-600 text-white" type="submit">
              Add Admin
            </button>
          </form>

          {adminFormError && <p className="text-red-600">{adminFormError}</p>}
          {adminFormSuccess && <p className="text-green-600">{adminFormSuccess}</p>}

          <div className="grid gap-2">
            {admins.map((a) => (
              <div
                key={a.username}
                className="p-3 rounded border dark:border-gray-700 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{a.username}</div>
                  <div className="text-xs opacity-70">
                    {JSON.stringify(a.permissions)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
                    onClick={() => handleOpenPermissionsModal(a)}
                  >
                    Permissions
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-red-600 text-white"
                    onClick={() => handleRemoveAdmin(a.username)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Permissions Modal */}
          {editingPermissionsFor && tempPermissions && (
            <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-900 p-4 rounded w-[480px] max-w-[95vw]">
                <h3 className="text-lg font-semibold mb-3">
                  Edit Permissions: {editingPermissionsFor.username}
                </h3>

                <div className="grid gap-2 mb-3">
                  <PermissionToggle
                    label="Can Add Movies"
                    isChecked={!!tempPermissions.canAddMovies}
                    onChange={(v) =>
                      setTempPermissions({ ...tempPermissions, canAddMovies: v })
                    }
                  />
                  <PermissionToggle
                    label="Can Edit Movies"
                    isChecked={!!tempPermissions.canEditMovies}
                    onChange={(v) =>
                      setTempPermissions({ ...tempPermissions, canEditMovies: v })
                    }
                  />
                  <PermissionToggle
                    label="Can Delete Movies"
                    isChecked={!!tempPermissions.canDeleteMovies}
                    onChange={(v) =>
                      setTempPermissions({ ...tempPermissions, canDeleteMovies: v })
                    }
                  />
                  <PermissionToggle
                    label="Can Live Edit"
                    isChecked={!!tempPermissions.canLiveEdit}
                    onChange={(v) =>
                      setTempPermissions({ ...tempPermissions, canLiveEdit: v })
                    }
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded bg-green-600 text-white"
                    onClick={handleSavePermissions}
                  >
                    Save
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-gray-300 dark:bg-gray-700"
                    onClick={() => {
                      setEditingPermissionsFor(null);
                      setTempPermissions(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default AdminPanel;
