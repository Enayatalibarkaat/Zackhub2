import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
  getAdmins,
  addAdmin,
  removeAdmin,
  updateAdminPermissions,
} from "./utils";

/** ---------- Config ---------- */
const TMDB_API_KEY = "2a2a62df397f68c9119a58e3a084e496";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/";

const getYoutubeEmbedUrl = (videoId: string): string =>
  videoId ? `https://www.youtube.com/embed/${videoId}` : "";

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

/** ---------- Helper UI component ---------- */
const PermissionToggle: React.FC<{
  label: string;
  isChecked: boolean;
  onChange: (isChecked: boolean) => void;
}> = ({ label, isChecked, onChange }) => (
  <div className="flex items-center justify-between p-3 bg-light-bg dark:bg-brand-bg rounded-md">
    <span className="font-medium text-light-text dark:text-brand-text">{label}</span>
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

interface AdminPanelProps {
  movies: Movie[];
  setMovies?: React.Dispatch<React.SetStateAction<Movie[]>>;
  onLogout: () => void;
  currentUser: CurrentUser | null;
}

const AdminPanel: React.FC<AdminPanelProps> = ({
  movies,
  setMovies,
  onLogout,
  currentUser,
}) => {
  // --- form/edit state
  const [formState, setFormState] = useState<Omit<Movie, "id">>(initialFormState);
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);

  // TMDB
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState("");
  const [tmdbResults, setTmdbResults] = useState<TmdbSearchResult[]>([]);
  const [isTmdbLoading, setIsTmdbLoading] = useState(false);
  const [tmdbError, setTmdbError] = useState<string | null>(null);

  // manage list
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [selectedManagedMovie, setSelectedManagedMovie] = useState<Movie | null>(null);

  // comments
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

  // admins
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [adminFormError, setAdminFormError] = useState("");
  const [adminFormSuccess, setAdminFormSuccess] = useState("");
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<AdminUser | null>(null);
  const [tempPermissions, setTempPermissions] = useState<AdminPermissions | null>(null);

  // Visitor Stats
  const [visitStats, setVisitStats] = useState({ today: 0, total: 0 });

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

  // --- DB Sync Logic ---
  const normalizeMovies = (list: any[]): Movie[] =>
    (list || []).map((m: any) => ({
      id: String(m.id || m._id),
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
      seasons: (m.seasons || []).map((s: any) => ({
        seasonNumber: s.seasonNumber,
        episodes: s.episodes || [],
        fullSeasonFiles: s.fullSeasonFiles || [], // Added New Field
      })),
      trailerLink: m.trailerLink || "",
      genres: m.genres || [],
      releaseDate: m.releaseDate || "",
      runtime: Number(m.runtime || 0),
      tagline: m.tagline || "",
      backdropUrl: m.backdropUrl || "",
    }));

  const fetchMovies = useCallback(async () => {
    try {
      const res = await fetch("/.netlify/functions/getMovies");
      const data = await res.json();
      const list = normalizeMovies(data?.movies || []);
      if (setMovies) setMovies(list);
    } catch (err) {
      console.error("Failed to load movies from DB:", err);
    }
  }, [setMovies]);

  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  // Visitor Stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/.netlify/functions/getStats");
        const data = await res.json();
        if (data && !data.error) {
          setVisitStats({ today: data.today || 0, total: data.total || 0 });
        }
      } catch (err) {
        console.error("Failed to fetch visitor stats:", err);
      }
    };
    fetchStats();
  }, []);

  // Admins
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
    if (window.confirm(`Are you sure you want to remove the admin "${username}"?`)) {
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
  // --- Comments Logic ---
  const movieMap = useMemo(() => new Map(movies.map((m) => [m.id, m.title])), [movies]);

  const loadAllComments = async () => {
    try {
      const res = await fetch("/.netlify/functions/getComments?movieId=all");
      const data = await res.json();
      if (data.success && data.comments) {
        const commentsWithTitles = data.comments.map((c: any) => ({
          ...c,
          movieTitle: movieMap.get(c.movieId) || "Unknown Movie",
        }));
        setAllComments(commentsWithTitles);
      } else {
        const fromStorage = getAllCommentsFromStorage().map((c) => ({
          ...c,
          movieTitle: movieMap.get(c.movieId) || "Unknown Movie",
        }));
        setAllComments(fromStorage);
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
      const fromStorage = getAllCommentsFromStorage().map((c) => ({
        ...c,
        movieTitle: movieMap.get(c.movieId) || "Unknown Movie",
      }));
      setAllComments(fromStorage);
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
      (c) => (c.name || c.username || "").toLowerCase() === commentSearch.trim().toLowerCase()
    );
    setFilteredComments(results);
  };

  const handleAdminReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !adminReplyingTo) return;
    try {
      const res = await fetch("/.netlify/functions/addComment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "ZackAdmin",
          movieId: adminReplyingTo.movieId,
          text: adminReplyText.trim(),
          parentId: adminReplyingTo.id || adminReplyingTo._id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Reply sent ✅");
        setAdminReplyText("");
        setAdminReplyingTo(null);
        await loadAllComments();
      } else {
        alert(data.message || "Failed to send reply ❌");
      }
    } catch (err) {
      console.error("Failed to send admin reply:", err);
      alert("Server error ❌");
    }
  };

  const handleDeleteComment = async (comment: any) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      const res = await fetch("/.netlify/functions/deleteComment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: comment.id || comment._id }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Comment deleted ✅");
        await loadAllComments();
      } else {
        alert(data.message || "Failed to delete ❌");
      }
    } catch (err) {
      console.error("Failed to delete comment:", err);
      alert("Server error ❌");
    }
  };

  // --- Form Helpers ---
  const isEditing = editingMovieId !== null;

  const resetForm = () => {
    setFormState(initialFormState);
    setEditingMovieId(null);
    setSelectedManagedMovie(null);
  };

  const handleStartEdit = (movie: Movie) => {
    setEditingMovieId(movie.id);
    setFormState({
      ...movie,
      rating: movie.rating || 0,
      runtime: movie.runtime || 0,
      downloadLinks: movie.downloadLinks || [],
      telegramLinks: movie.telegramLinks || [],
      seasons: (movie.seasons || []).map(s => ({
        ...s,
        episodes: s.episodes || [],
        fullSeasonFiles: s.fullSeasonFiles || []
      })),
      trailerLink: movie.trailerLink || "",
      genres: movie.genres || [],
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState((prev) => ({ ...prev, posterUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  // --- Link Helpers ---
  const handleDownloadLinkChange = (index: number, field: keyof DownloadLink, value: string) => {
    const updated = formState.downloadLinks ? [...formState.downloadLinks] : [];
    if (!updated[index]) updated[index] = { quality: "", url: "" };
    updated[index][field] = value;
    setFormState((p) => ({ ...p, downloadLinks: updated }));
  };
  const addDownloadLink = () =>
    setFormState((p) => ({ ...p, downloadLinks: [...(p.downloadLinks || []), { quality: "", url: "" }] }));
  const removeDownloadLink = (index: number) =>
    setFormState((p) => ({ ...p, downloadLinks: (p.downloadLinks || []).filter((_, i) => i !== index) }));

  const handleTelegramLinkChange = (index: number, field: keyof TelegramLink, value: string) => {
    const updated = formState.telegramLinks ? [...formState.telegramLinks] : [];
    if (!updated[index]) updated[index] = { quality: "", fileId: "" };
    updated[index][field] = value;
    setFormState((p) => ({ ...p, telegramLinks: updated }));
  };
  const addTelegramLink = () =>
    setFormState((p) => ({ ...p, telegramLinks: [...(p.telegramLinks || []), { quality: "", fileId: "" }] }));
  const removeTelegramLink = (index: number) =>
    setFormState((p) => ({ ...p, telegramLinks: (p.telegramLinks || []).filter((_, i) => i !== index) }));

  // --- Seasons & Episodes Helpers ---
  const addSeason = () => {
    const newSeasonNumber = formState.seasons ? formState.seasons.length + 1 : 1;
    const newSeason: Season = { seasonNumber: newSeasonNumber, episodes: [], fullSeasonFiles: [] };
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
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks.push({ quality: "", url: "" });
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const removeEpisodeDownloadLink = (seasonIndex: number, episodeIndex: number, linkIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks =
      newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks.filter((_: any, i: number) => i !== linkIndex);
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const handleEpisodeDownloadLinkChange = (seasonIndex: number, episodeIndex: number, linkIndex: number, field: keyof DownloadLink, value: string) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].downloadLinks[linkIndex][field] = value;
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const addEpisodeTelegramLink = (seasonIndex: number, episodeIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    if (!newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks) {
      newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks = [];
    }
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks.push({ quality: "", fileId: "" });
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const removeEpisodeTelegramLink = (seasonIndex: number, episodeIndex: number, linkIndex: number) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks =
      newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks.filter((_: any, i: number) => i !== linkIndex);
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  const handleEpisodeTelegramLinkChange = (seasonIndex: number, episodeIndex: number, linkIndex: number, field: keyof TelegramLink, value: string) => {
    const newSeasons = JSON.parse(JSON.stringify(formState.seasons || []));
    newSeasons[seasonIndex].episodes[episodeIndex].telegramLinks[linkIndex][field] = value;
    setFormState((p) => ({ ...p, seasons: newSeasons }));
  };
  // --- FULL SEASON FILE HELPERS (NEW) ---
  const addSeasonFile = (sIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    if (!ns[sIdx].fullSeasonFiles) ns[sIdx].fullSeasonFiles = [];
    ns[sIdx].fullSeasonFiles.push({ title: "", downloadLinks: [], telegramLinks: [] });
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const removeSeasonFile = (sIdx: number, fIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles = ns[sIdx].fullSeasonFiles.filter((_: any, i: number) => i !== fIdx);
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const handleSeasonFileTitleChange = (sIdx: number, fIdx: number, value: string) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].title = value;
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  // Full Season TG Links
  const addSeasonFileTG = (sIdx: number, fIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].telegramLinks.push({ quality: "", fileId: "" });
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const rmSeasonFileTG = (sIdx: number, fIdx: number, lIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].telegramLinks = ns[sIdx].fullSeasonFiles[fIdx].telegramLinks.filter((_: any, i: number) => i !== lIdx);
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const chgSeasonFileTG = (sIdx: number, fIdx: number, lIdx: number, f: string, v: string) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].telegramLinks[lIdx][f] = v;
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  // Full Season DL Links
  const addSeasonFileDL = (sIdx: number, fIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].downloadLinks.push({ quality: "", url: "" });
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const rmSeasonFileDL = (sIdx: number, fIdx: number, lIdx: number) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].downloadLinks = ns[sIdx].fullSeasonFiles[fIdx].downloadLinks.filter((_: any, i: number) => i !== lIdx);
    setFormState((p) => ({ ...p, seasons: ns }));
  };
  const chgSeasonFileDL = (sIdx: number, fIdx: number, lIdx: number, f: string, v: string) => {
    const ns = JSON.parse(JSON.stringify(formState.seasons || []));
    ns[sIdx].fullSeasonFiles[fIdx].downloadLinks[lIdx][f] = v;
    setFormState((p) => ({ ...p, seasons: ns }));
  };

  // --- TMDB Search Logic ---
  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;
    setIsTmdbLoading(true);
    setTmdbError(null);
    try {
      const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(tmdbSearchQuery.trim())}`;
      const res = await fetch(url);
      const data = await res.json();
      const filtered = (data?.results || []).filter((item: any) => item.media_type === "movie" || item.media_type === "tv");
      setTmdbResults(filtered as TmdbSearchResult[]);
    } catch (err: any) {
      setTmdbError("TMDB search failed");
      console.error(err);
    } finally {
      setIsTmdbLoading(false);
    }
  };

  const handleSelectTmdbResult = async (result: TmdbSearchResult) => {
    setIsTmdbLoading(true);
    setTmdbError(null);
    try {
      const detailUrl = `${TMDB_BASE_URL}/${result.media_type}/${result.id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`;
      const res = await fetch(detailUrl);
      const details: TmdbDetailResponse = await res.json();
      const poster = details.poster_path ? `${TMDB_IMAGE_BASE_URL}w500${details.poster_path}` : "";
      const backdrop = details.backdrop_path ? `${TMDB_IMAGE_BASE_URL}w1280${details.backdrop_path}` : "";
      const trailerKey = details.videos?.results?.find((v: any) => v.type === "Trailer")?.key || "";
      const credits = details.credits;
      const director = credits?.crew?.find((c: any) => c.job === "Director")?.name || "";
      const producers = credits?.crew?.filter((c: any) => c.job === "Producer").map((p: any) => p.name).slice(0,3).join(", ") || "";
      const actors = credits?.cast?.slice(0,5).map((a: any) => a.name).join(", ") || "";

      setFormState((p) => ({
        ...p,
        title: (details as any).title || (details as any).name || "",
        posterUrl: poster,
        backdropUrl: backdrop,
        description: details.overview || "",
        actors: actors,
        director: director,
        producer: producers,
        rating: (details.vote_average && Number(Number(details.vote_average).toFixed(1))) || 0,
        category: result.media_type === "tv" ? "webseries" : p.category,
        genres: details.genres || [],
        releaseDate: (details as any).release_date || (details as any).first_air_date || "",
        runtime: (details as any).runtime || (details as any).episode_run_time?.[0] || 0,
        tagline: details.tagline || "",
        trailerLink: trailerKey ? getYoutubeEmbedUrl(trailerKey) : "",
      }));
      setTmdbResults([]);
      setTmdbSearchQuery("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("TMDB detail fetch failed:", err);
      setTmdbError("Failed to fetch TMDB details");
    } finally {
      setIsTmdbLoading(false);
    }
  };
  // --- CRUD ---
  const saveNewMovie = async () => {
    const payload = { ...formState, rating: Number(formState.rating) || 0, runtime: Number(formState.runtime) || 0, category: formState.category as MovieCategory };
    const res = await fetch("/.netlify/functions/addMovie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error("Add movie failed");
  };
  const updateMovie = async (id: string) => {
    const payload = { id, ...{ ...formState, rating: Number(formState.rating) || 0, runtime: Number(formState.runtime) || 0, category: formState.category as MovieCategory } };
    const res = await fetch("/.netlify/functions/updateMovie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error("Update movie failed");
  };
  const deleteMovie = async (id: string) => {
    const res = await fetch("/.netlify/functions/deleteMovie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!res.ok) throw new Error("Delete movie failed");
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMovieId) {
        if (!hasPermission("canEditMovies") && !hasPermission("canEditContent")) { alert("No Permission"); return; }
        await updateMovie(editingMovieId);
      } else {
        if (!hasPermission("canAddMovies") && !hasPermission("canAddContent")) { alert("No Permission"); return; }
        await saveNewMovie();
      }
      await fetchMovies();
      resetForm();
      alert("Saved successfully!");
    } catch (err: any) { console.error(err); alert(err?.message || "Save failed"); }
  };
  const handleRemove = async (id: string, title: string) => {
    if (!hasPermission("canDeleteMovies") && !hasPermission("canDeleteContent")) { alert("No Permission"); return; }
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await deleteMovie(id);
      await fetchMovies();
      alert("Removed.");
      if (editingMovieId === id) resetForm();
      setSelectedManagedMovie(null);
    } catch (err: any) { console.error(err); alert("Remove failed"); }
  };

  // UI Helpers
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleMouseMove = useCallback((e: MouseEvent) => { if (sidebarRef.current) { const newWidth = window.innerWidth - e.clientX; const clamped = Math.max(400, Math.min(newWidth, window.innerWidth * 0.98)); sidebarRef.current.style.width = `${clamped}px`; } }, []);
  const handleMouseUp = useCallback(() => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); document.body.style.userSelect = ""; }, [handleMouseMove]);
  const handleMouseDownOnResize = (e: React.MouseEvent) => { e.preventDefault(); document.addEventListener("mousemove", handleMouseMove); document.addEventListener("mouseup", handleMouseUp); document.body.style.userSelect = "none"; };
  useEffect(() => () => handleMouseUp(), [handleMouseUp]);

  const inputClass = "w-full p-2 bg-light-bg dark:bg-brand-bg rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-colors text-light-text dark:text-brand-text";
  const commentsToDisplay = searchedUsername ? filteredComments : allComments.slice(0, 50);
  const filteredManagedMovies = useMemo(() => movies.filter((movie) => movie.title.toLowerCase().includes(manageSearchQuery.toLowerCase())), [movies, manageSearchQuery]);

  return (
    <div className="container mx-auto p-4 animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          {hasPermission("canManageComments") && (
            <button onClick={() => setIsCommentSidebarOpen(true)} className="p-2 rounded-md text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /><path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-1z" /></svg></button>
          )}
          <h1 className="text-3xl font-bold text-brand-primary">Admin Panel</h1>
        </div>
        <button onClick={onLogout} className="bg-gray-500 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300">Logout</button>
      </div>

      {/* --- VISITOR STATS --- */}
      <div className="mb-8">
        <h2 className="text-2xl mb-4 text-light-text dark:text-brand-text font-semibold">Visitor Insights</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-lg shadow-md text-white"><p className="text-4xl font-bold">{visitStats.today}</p><p className="text-sm opacity-90 mt-1">Today</p></div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4 rounded-lg shadow-md text-white"><p className="text-4xl font-bold">{visitStats.total}</p><p className="text-sm opacity-90 mt-1">Monthly</p></div>
        </div>
      </div>

      {hasPermission("canManageComments") && (
        <>
          <div className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${isCommentSidebarOpen ? "bg-opacity-60" : "bg-opacity-0 pointer-events-none"}`} onClick={() => setIsCommentSidebarOpen(false)} />
          <div ref={sidebarRef} className={`fixed top-0 right-0 h-full bg-light-sidebar dark:bg-brand-sidebar shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out w-[90vw] md:w-[50vw] ${isCommentSidebarOpen ? "translate-x-0" : "translate-x-full"}`} role="dialog">
            <div onMouseDown={handleMouseDownOnResize} className="absolute top-0 -left-1 w-2 h-full cursor-col-resize group z-10 hidden md:block"><div className="w-full h-full bg-transparent group-hover:bg-brand-primary/50 transition-colors duration-200" /></div>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-xl font-bold text-light-text dark:text-brand-text">Comments</h2>
              <button onClick={() => setIsCommentSidebarOpen(false)} className="p-2 rounded-full text-light-text-secondary hover:bg-black/5 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <form onSubmit={handleCommentSearch} className="flex gap-2">
                <input type="text" placeholder="Search username..." value={commentSearch} onChange={(e) => setCommentSearch(e.target.value)} className="w-full p-2 bg-light-card dark:bg-brand-card rounded border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-primary" />
                <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">Search</button>
              </form>
            </div>
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
              {commentsToDisplay.length > 0 ? commentsToDisplay.map(comment => (
                <div key={comment.id} className="p-3 bg-light-card dark:bg-brand-card rounded-lg shadow-sm">
                  <div className="flex justify-between items-center text-xs"><p className="font-bold text-light-text dark:text-brand-text">{comment.name}</p><p className="text-light-text-secondary dark:text-brand-text-secondary">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : "Unknown"}</p></div>
                  <p className="text-xs text-light-text-secondary mt-1">On: <span className="font-semibold text-brand-primary">{comment.movieTitle}</span></p>
                  <p className="mt-2 text-sm text-light-text dark:text-brand-text">{comment.text}</p>
                  <div className="text-right mt-2 flex justify-end items-center gap-4"><button onClick={() => setAdminReplyingTo(comment)} className="text-xs font-bold text-blue-500 hover:underline">Reply</button><button onClick={() => handleDeleteComment(comment)} className="text-xs font-bold text-red-500 hover:underline">Delete</button></div>
                </div>
              )) : (<p className="text-center text-light-text-secondary py-4">No comments.</p>)}
            </div>
          </div>
        </>
      )}

      {isSuperAdmin && (
        <div className="bg-light-card dark:bg-brand-card p-6 rounded-lg mb-8 shadow-md">
          <h2 className="text-2xl mb-4 text-light-text dark:text-brand-text font-semibold">Admins</h2>
          <form onSubmit={handleAddAdmin} className="border border-gray-300 dark:border-gray-600 p-4 rounded-md mb-6 space-y-3 bg-light-bg/50 dark:bg-brand-bg/50">
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Username" value={newAdminUsername} onChange={(e) => setNewAdminUsername(e.target.value)} className={inputClass} />
              <input type="password" placeholder="Password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} className={inputClass} />
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">Add</button>
            </div>
            {adminFormError && <p className="text-red-500 text-sm">{adminFormError}</p>}
            {adminFormSuccess && <p className="text-green-500 text-sm">{adminFormSuccess}</p>}
          </form>
          <div>
            {admins.length > 0 ? (<ul className="space-y-2">{admins.map(admin => (
              <li key={admin.username} className="flex flex-col sm:flex-row justify-between items-center p-3 bg-light-bg dark:bg-brand-bg rounded-md gap-2">
                <span className="font-medium text-light-text dark:text-brand-text">{admin.username}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenPermissionsModal(admin)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-md text-sm">Perms</button>
                  <button onClick={() => handleRemoveAdmin(admin.username)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-md text-sm">Del</button>
                </div>
              </li>
            ))}</ul>) : (<p className="text-light-text-secondary text-center py-2">No other admins.</p>)}
          </div>
        </div>
      )}
      {hasPermission("canAddContent") && (
        <div className="bg-light-card dark:bg-brand-card p-6 rounded-lg mb-8 shadow-md">
          <h2 className="text-2xl mb-4 text-light-text dark:text-brand-text font-semibold">{isEditing ? `Edit "${formState.title}"` : "Add Content"}</h2>
          <div className="border border-gray-300 dark:border-gray-600 p-4 rounded-md mb-6 space-y-3 bg-light-bg/50 dark:bg-brand-bg/50">
            <div className="flex gap-2">
              <input type="text" value={tmdbSearchQuery} onChange={(e) => setTmdbSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleTmdbSearch())} placeholder="TMDB Search" className={inputClass} />
              <button type="button" onClick={handleTmdbSearch} disabled={isTmdbLoading || !tmdbSearchQuery} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">{isTmdbLoading ? "..." : "Go"}</button>
            </div>
            {tmdbResults.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4 max-h-96 overflow-y-auto p-2 border-t border-gray-300 dark:border-gray-600">
                {tmdbResults.map((result) => (
                  <div key={result.id} onClick={() => handleSelectTmdbResult(result)} className="cursor-pointer group text-center animate-fade-in">
                    <img src={result.poster_path ? `${TMDB_IMAGE_BASE_URL}w200${result.poster_path}` : "https://via.placeholder.com/200x300"} alt={result.title || result.name} className="rounded-md shadow-md group-hover:opacity-75 transition-opacity aspect-[2/3] object-cover w-full" />
                    <p className="text-sm mt-2 font-medium text-light-text dark:text-brand-text truncate">{result.title || result.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="text" name="title" value={formState.title} onChange={handleInputChange} placeholder="Title" required className={inputClass} />
            <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20" />
            {formState.posterUrl && <img src={formState.posterUrl} alt="Preview" className="mt-4 rounded-lg w-32 h-48 object-cover shadow-md" />}
            <textarea name="description" value={formState.description} onChange={handleInputChange} placeholder="Description" required className={`${inputClass} h-24`}></textarea>
            <input type="text" name="actors" value={formState.actors} onChange={handleInputChange} placeholder="Actors" required className={inputClass} />
            <input type="text" name="director" value={formState.director} onChange={handleInputChange} placeholder="Director" required className={inputClass} />
            <input type="text" name="producer" value={formState.producer} onChange={handleInputChange} placeholder="Producer" required className={inputClass} />
            <input type="number" name="rating" value={formState.rating || ""} onChange={handleInputChange} placeholder="Rating" step="0.1" className={inputClass} />
            <input type="text" name="trailerLink" value={formState.trailerLink || ""} onChange={handleInputChange} placeholder="Trailer Link" className={inputClass} />
            <select name="category" value={formState.category} onChange={handleInputChange} className={inputClass}>
              <option value="hollywood">Hollywood</option>
              <option value="bollywood">Bollywood</option>
              <option value="south-indian">South Indian</option>
              <option value="webseries">Webseries</option>
            </select>

            {formState.category === "webseries" ? (
              <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md space-y-3">
                <legend className="px-2 text-sm font-medium text-light-text-secondary dark:text-brand-text-secondary">Seasons & Episodes</legend>
                {formState.seasons?.map((season, seasonIndex) => (
                  <fieldset key={seasonIndex} className="border border-gray-200 dark:border-gray-700 p-3 rounded-md space-y-3 bg-light-bg/30 dark:bg-brand-bg/30">
                    <div className="flex justify-between items-center">
                      <legend className="text-lg font-semibold text-light-text dark:text-brand-text">Season {season.seasonNumber}</legend>
                      <button type="button" onClick={() => removeSeason(seasonIndex)} className="text-red-500 hover:text-red-700 text-sm">Remove Season</button>
                    </div>

                    {/* --- NEW: FULL SEASON FILES SECTION --- */}
                    <div className="pl-4 border-l-2 border-brand-primary/30 ml-2 my-4">
                      <p className="text-sm font-bold text-brand-primary mb-2">Full Season / Part Files</p>
                      {season.fullSeasonFiles?.map((file, fIdx) => (
                        <div key={fIdx} className="mb-4 bg-black/5 dark:bg-white/5 p-3 rounded">
                          <div className="flex gap-2 mb-2">
                            <input type="text" placeholder="Title (e.g. Full Season 1 Zip)" value={file.title} onChange={(e) => handleSeasonFileTitleChange(seasonIndex, fIdx, e.target.value)} className={`${inputClass} flex-grow`} />
                            <button type="button" onClick={() => removeSeasonFile(seasonIndex, fIdx)} className="bg-red-600 p-2 rounded text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                          </div>
                          <div className="ml-4 mb-2">
                            <p className="text-xs font-semibold opacity-70">Telegram Links</p>
                            {file.telegramLinks.map((l, lIdx) => (
                              <div key={lIdx} className="flex gap-2 mt-1">
                                <input type="text" placeholder="Quality" value={l.quality} onChange={(e) => chgSeasonFileTG(seasonIndex, fIdx, lIdx, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                                <input type="text" placeholder="File ID" value={l.fileId} onChange={(e) => chgSeasonFileTG(seasonIndex, fIdx, lIdx, "fileId", e.target.value)} className={`${inputClass} flex-grow`} />
                                <button type="button" onClick={() => rmSeasonFileTG(seasonIndex, fIdx, lIdx)} className="text-red-500">x</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addSeasonFileTG(seasonIndex, fIdx)} className="text-blue-500 text-xs mt-1">+ Add TG Link</button>
                          </div>
                          <div className="ml-4">
                            <p className="text-xs font-semibold opacity-70">Download Links</p>
                            {file.downloadLinks.map((l, lIdx) => (
                              <div key={lIdx} className="flex gap-2 mt-1">
                                <input type="text" placeholder="Quality" value={l.quality} onChange={(e) => chgSeasonFileDL(seasonIndex, fIdx, lIdx, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                                <input type="url" placeholder="URL" value={l.url} onChange={(e) => chgSeasonFileDL(seasonIndex, fIdx, lIdx, "url", e.target.value)} className={`${inputClass} flex-grow`} />
                                <button type="button" onClick={() => rmSeasonFileDL(seasonIndex, fIdx, lIdx)} className="text-red-500">x</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => addSeasonFileDL(seasonIndex, fIdx)} className="text-blue-500 text-xs mt-1">+ Add DL Link</button>
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={() => addSeasonFile(seasonIndex)} className="bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold py-1 px-3 rounded text-sm">+ Add Full Season File</button>
                    </div>

                    {season.episodes.map((episode, episodeIndex) => (
                      <div key={episodeIndex} className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-light-text dark:text-brand-text">Episode {episode.episodeNumber}</p>
                          <button type="button" onClick={() => removeEpisode(seasonIndex, episodeIndex)} className="text-red-500 hover:text-red-700 text-xs">Remove Episode</button>
                        </div>
                        <input type="text" placeholder="Episode Title" value={episode.title} onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, "title", e.target.value)} className={inputClass} />
                        <div className="pl-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                          <p className="text-xs font-semibold text-light-text-secondary dark:text-brand-text-secondary">Telegram Links</p>
                          {episode.telegramLinks?.map((link, linkIndex) => (
                            <div key={linkIndex} className="flex items-center gap-2">
                              <input type="text" placeholder="Quality" value={link.quality} onChange={(e) => handleEpisodeTelegramLinkChange(seasonIndex, episodeIndex, linkIndex, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                              <input type="text" placeholder="File ID" value={link.fileId} onChange={(e) => handleEpisodeTelegramLinkChange(seasonIndex, episodeIndex, linkIndex, "fileId", e.target.value)} className={`${inputClass} flex-grow`} />
                              <button type="button" onClick={() => removeEpisodeTelegramLink(seasonIndex, episodeIndex, linkIndex)} className="bg-red-600 p-2 rounded text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addEpisodeTelegramLink(seasonIndex, episodeIndex)} className="text-blue-500 hover:text-blue-700 text-sm">+ Add Telegram Link</button>
                        </div>
                        <div className="pl-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                          <p className="text-xs font-semibold text-light-text-secondary dark:text-brand-text-secondary">Direct Links</p>
                          {episode.downloadLinks.map((link, linkIndex) => (
                            <div key={linkIndex} className="flex items-center gap-2">
                              <input type="text" placeholder="Quality" value={link.quality} onChange={(e) => handleEpisodeDownloadLinkChange(seasonIndex, episodeIndex, linkIndex, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                              <input type="url" placeholder="URL" value={link.url} onChange={(e) => handleEpisodeDownloadLinkChange(seasonIndex, episodeIndex, linkIndex, "url", e.target.value)} className={`${inputClass} flex-grow`} />
                              <button type="button" onClick={() => removeEpisodeDownloadLink(seasonIndex, episodeIndex, linkIndex)} className="bg-red-600 p-2 rounded text-white"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => addEpisodeDownloadLink(seasonIndex, episodeIndex)} className="text-blue-500 hover:text-blue-700 text-sm">+ Add Direct Link</button>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addEpisode(seasonIndex)} className="bg-green-500/20 hover:bg-green-500/30 text-green-700 dark:text-green-300 font-bold py-1 px-3 rounded text-sm">+ Add Episode</button>
                  </fieldset>
                ))}
                <button type="button" onClick={addSeason} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors text-sm">+ Add Season</button>
              </fieldset>
            ) : (
              <>
                <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md space-y-3">
                  <legend className="px-2 text-sm font-medium text-light-text-secondary dark:text-brand-text-secondary">Telegram Links</legend>
                  {formState.telegramLinks?.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 animate-fade-in">
                      <input type="text" placeholder="Quality" value={link.quality} onChange={(e) => handleTelegramLinkChange(index, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                      <input type="text" placeholder="File ID" value={link.fileId} onChange={(e) => handleTelegramLinkChange(index, "fileId", e.target.value)} className={`${inputClass} flex-grow`} />
                      <button type="button" onClick={() => removeTelegramLink(index)} className="bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                    </div>
                  ))}
                  <button type="button" onClick={addTelegramLink} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm">+ Add Telegram Link</button>
                </fieldset>
                <fieldset className="border border-gray-300 dark:border-gray-600 p-4 rounded-md space-y-3">
                  <legend className="px-2 text-sm font-medium text-light-text-secondary dark:text-brand-text-secondary">Download Links</legend>
                  {formState.downloadLinks?.map((link, index) => (
                    <div key={index} className="flex items-center gap-2 animate-fade-in">
                      <input type="text" placeholder="Quality" value={link.quality} onChange={(e) => handleDownloadLinkChange(index, "quality", e.target.value)} className={`${inputClass} w-1/3`} />
                      <input type="url" placeholder="URL" value={link.url} onChange={(e) => handleDownloadLinkChange(index, "url", e.target.value)} className={`${inputClass} flex-grow`} />
                      <button type="button" onClick={() => removeDownloadLink(index)} className="bg-red-600 hover:bg-red-700 text-white font-bold p-2 rounded flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                    </div>
                  ))}
                  <button type="button" onClick={addDownloadLink} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm">+ Add Download Link</button>
                </fieldset>
              </>
            )}

            <div className="flex items-center gap-4">
              <button type="submit" className="bg-brand-primary hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded transition-colors duration-300">{isEditing ? "Save Changes" : "Add Item"}</button>
              {isEditing && (<button type="button" onClick={resetForm} className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-700 text-light-text dark:text-brand-text font-bold py-2 px-4 rounded">Cancel Edit</button>)}
            </div>
          </form>
        </div>
      )}

      <div className="mt-12">
        <h2 className="text-2xl mb-4 text-light-text dark:text-brand-text font-semibold">Content Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 text-center">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key} className="bg-light-bg dark:bg-brand-bg p-4 rounded-lg shadow-md">
              <p className="text-3xl font-bold text-brand-primary">{value}</p>
              <p className="text-sm font-medium text-light-text-secondary dark:text-brand-text-secondary mt-1 capitalize">{key.replace("-", " ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl mb-4 text-light-text dark:text-brand-text font-semibold">Manage Content</h2>
        <div className="mb-4"><input type="text" placeholder="Search existing content..." value={manageSearchQuery} onChange={(e) => setManageSearchQuery(e.target.value)} className={inputClass} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredManagedMovies.length > 0 ? filteredManagedMovies.map((movie) => (
            <div key={movie.id} className="bg-light-card dark:bg-brand-card rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all transform hover:-translate-y-1 cursor-pointer group" onClick={() => setSelectedManagedMovie(movie)}>
              <img src={movie.posterUrl} alt={movie.title} className="w-full h-auto aspect-[2/3] object-cover" />
              <div className="p-2"><p className="font-semibold truncate text-sm text-light-text dark:text-brand-text group-hover:text-brand-primary">{movie.title}</p></div>
            </div>
          )) : (<p className="col-span-full text-center text-light-text-secondary">No content found.</p>)}
        </div>
      </div>

      {selectedManagedMovie && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 animate-fade-in" onClick={() => setSelectedManagedMovie(null)}>
          <div className="bg-light-card dark:bg-brand-card p-6 rounded-xl shadow-2xl w-full max-w-sm m-4 flex flex-col items-center gap-6 relative" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-center text-light-text dark:text-brand-text">{selectedManagedMovie.title}</h3>
            <img src={selectedManagedMovie.posterUrl} alt="poster" className="w-full max-w-xs h-auto aspect-[2/3] object-cover rounded-lg shadow-lg" />
            <div className="w-full flex flex-col gap-3">
              {hasPermission("canEditContent") && <button onClick={() => handleStartEdit(selectedManagedMovie)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg">Edit Post</button>}
              {hasPermission("canDeleteContent") && <button onClick={() => handleRemove(selectedManagedMovie.id, selectedManagedMovie.title)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg">Remove Post</button>}
            </div>
            <button onClick={() => setSelectedManagedMovie(null)} className="absolute top-2 right-2 p-2 rounded-full text-light-text-secondary dark:text-brand-text-secondary hover:bg-black/10 dark:hover:bg-white/10"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
      )}

      {adminReplyingTo && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={() => setAdminReplyingTo(null)}>
          <div className="bg-light-card dark:bg-brand-card p-6 rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2 dark:text-white">Reply</h3>
            <p className="mb-4 italic text-gray-400">"{adminReplyingTo.text}"</p>
            <form onSubmit={handleAdminReplySubmit}>
              <textarea value={adminReplyText} onChange={(e) => setAdminReplyText(e.target.value)} className="w-full p-2 rounded dark:bg-gray-800 dark:text-white" rows={4} required />
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setAdminReplyingTo(null)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Send</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPermissionsFor && tempPermissions && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={() => setEditingPermissionsFor(null)}>
          <div className="bg-light-card dark:bg-brand-card p-6 rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4 dark:text-white">Permissions for {editingPermissionsFor.username}</h3>
            <div className="space-y-3">
              <PermissionToggle label="Add Content" isChecked={!!tempPermissions.canAddContent} onChange={(c) => setTempPermissions(p => ({ ...p!, canAddContent: c }))} />
              <PermissionToggle label="Edit Content" isChecked={!!tempPermissions.canEditContent} onChange={(c) => setTempPermissions(p => ({ ...p!, canEditContent: c }))} />
              <PermissionToggle label="Delete Content" isChecked={!!tempPermissions.canDeleteContent} onChange={(c) => setTempPermissions(p => ({ ...p!, canDeleteContent: c }))} />
              <PermissionToggle label="Manage Comments" isChecked={!!tempPermissions.canManageComments} onChange={(c) => setTempPermissions(p => ({ ...p!, canManageComments: c }))} />
              <PermissionToggle label="Live Edit" isChecked={!!tempPermissions.canLiveEdit} onChange={(c) => setTempPermissions(p => ({ ...p!, canLiveEdit: c }))} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditingPermissionsFor(null)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancel</button>
              <button onClick={handleSavePermissions} className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
