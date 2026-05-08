import axios from 'axios';
import { supabase } from './supabase';

// In production (Vercel), VITE_API_URL is set to the Railway backend URL.
// In development, it is unset and Vite's proxy forwards /api → localhost:3001.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 10000,
});

// Attach Supabase JWT to every request if logged in
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// ---------------------------------------------------------------
// Movie pool cache — two-tier to minimise network hits.
//
// Tier 1: in-memory Map (same tab session, instant).
// Tier 2: localStorage with 24-hour TTL (across page reloads).
//
// POOL_CACHE_VERSION: bump this whenever the movie schema gains new fields
// (e.g. production_studio) so all clients automatically discard stale
// cached pools and re-fetch with the new columns populated.
//
// All of this is transparent — callers still use getMoviePool(category)
// exactly as before.
// ---------------------------------------------------------------
const POOL_CACHE_VERSION = 2;              // bump when schema changes
const POOL_CACHE_TTL  = 24 * 60 * 60 * 1000; // 24 hours in ms
const poolMemoryCache = new Map(); // category → data array

function lsKey(category) {
  return `cg_pool_v${POOL_CACHE_VERSION}_${category}`;
}

function lsRead(category) {
  try {
    const raw = localStorage.getItem(lsKey(category));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > POOL_CACHE_TTL) {
      localStorage.removeItem(lsKey(category));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function lsWrite(category, data) {
  try {
    localStorage.setItem(lsKey(category), JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {
    // QuotaExceededError — silently skip; in-memory cache still works.
    if (e?.name === 'QuotaExceededError') {
      // Try to evict oldest pool entry to free space
      try {
        for (const cat of ['top250', 'superhero', 'animated', 'indiancinema']) {
          if (cat !== category) localStorage.removeItem(lsKey(cat));
        }
        localStorage.setItem(lsKey(category), JSON.stringify({ ts: Date.now(), data }));
      } catch {
        // Give up — in-memory will cover this session
      }
    }
  }
}

// Wipe both cache tiers — called by the "Refresh Data" button in Settings.
export function clearPoolCache() {
  poolMemoryCache.clear();
  try {
    for (const cat of ['top250', 'superhero', 'animated', 'indiancinema']) {
      localStorage.removeItem(lsKey(cat));
    }
  } catch { /* localStorage may be unavailable */ }
}

// ---------------------------------------------------------------
// Game
// ---------------------------------------------------------------
export const getMoviePool = async (category) => {
  // 1. Check in-memory cache first (fastest path)
  if (poolMemoryCache.has(category)) return poolMemoryCache.get(category);

  // 2. Check localStorage
  const cached = lsRead(category);
  if (cached) {
    poolMemoryCache.set(category, cached);
    return cached;
  }

  // 3. Fetch from server
  const data = await api.get(`/game/movies/${category}`).then(r => r.data);
  poolMemoryCache.set(category, data);
  lsWrite(category, data);
  return data;
};
export const getDailyState    = (category) => api.get(`/game/daily/${category}`).then(r => r.data);
export const submitGuess      = (category, tmdb_id, guess_count, hints_count = 0, hints_cost = 0) =>
  api.post('/game/guess', { category, tmdb_id, guess_count, hints_count, hints_cost }).then(r => r.data);
export const checkGuess       = (guessed_tmdb_id, target_tmdb_id, guess_number, category) =>
  api.post('/game/guess/check', { guessed_tmdb_id, target_tmdb_id, guess_number, category }).then(r => r.data);
export const getResult        = (category) => api.get(`/game/result/${category}`).then(r => r.data);
export const getStreaks       = (category) => api.get(`/game/streaks/${category}`).then(r => r.data);
export const getPercentiles   = () => api.get('/game/percentiles').then(r => r.data);
export const submitUnlimitedResult = (category, won) =>
  api.post('/game/unlimited/result', { category, won }).then(r => r.data);
export const getUnlimitedSession  = (category) =>
  api.get(`/game/unlimited/current/${category}`).then(r => r.data);
export const saveUnlimitedSession = (category, data) =>
  api.put(`/game/unlimited/current/${category}`, data).then(r => r.data);
export const getCalendar      = (category) => api.get(`/game/calendar/${category}`).then(r => r.data);
export const getYearCalendar  = (year) => api.get('/game/calendar-year', { params: { year } }).then(r => r.data);
export const getRatings       = (tmdb_id) => api.get(`/game/ratings/${tmdb_id}`).then(r => r.data);
export const getLeaderboard   = (category) =>
  api.get('/game/leaderboard', { params: category ? { category } : {} }).then(r => r.data);
export const getUserBadges    = () => api.get('/game/badges').then(r => r.data);

// ---------------------------------------------------------------
// Auth profile
// ---------------------------------------------------------------
export const registerProfile  = (username) => api.post('/auth/register', { username }).then(r => r.data);
export const getProfile       = () => api.get('/auth/profile').then(r => r.data);
export const updateUsername   = (username) => api.patch('/auth/username', { username }).then(r => r.data);
export const deleteAccount    = () => api.delete('/auth/account').then(r => r.data);
export const searchUsers      = (q) => api.get('/auth/search', { params: { q } }).then(r => r.data);
// Check whether an email address has a registered account (used by forgot-password).
export const checkEmailExists = (email) => api.post('/auth/check-email', { email }).then(r => r.data);
// Resolve a username or email → canonical email (used for username sign-in)
export const lookupEmail      = (login) => api.post('/auth/lookup', { login }).then(r => r.data);

// ---------------------------------------------------------------
// Friends
// ---------------------------------------------------------------
export const getFriends       = () => api.get('/friends').then(r => r.data);
export const getFriendRequests = () => api.get('/friends/requests').then(r => r.data);
export const sendFriendRequest = (receiver_username) =>
  api.post('/friends/request', { receiver_username }).then(r => r.data);
export const acceptFriendRequest = (requester_id) =>
  api.post('/friends/accept', { requester_id }).then(r => r.data);
export const declineFriendRequest = (requester_id) =>
  api.post('/friends/decline', { requester_id }).then(r => r.data);
export const unfriend = (friend_id) =>
  api.delete(`/friends/${friend_id}`).then(r => r.data);
export const getFriendYearCalendar = (friend_id, year) =>
  api.get(`/friends/${friend_id}/calendar-year`, { params: { year } }).then(r => r.data);
export const getFriendPercentiles = (friend_id) =>
  api.get(`/friends/${friend_id}/percentiles`).then(r => r.data);
export const getFriendFriends = (friend_id) =>
  api.get(`/friends/${friend_id}/friends`).then(r => r.data);
export const getFriendBadges  = (friend_id) =>
  api.get(`/friends/${friend_id}/badges`).then(r => r.data);
export const addVip    = (friend_id) => api.post(`/friends/vip/${friend_id}`).then(r => r.data);
export const removeVip = (friend_id) => api.delete(`/friends/vip/${friend_id}`).then(r => r.data);
export const getSentRequests = () =>
  api.get('/friends/sent-requests').then(r => r.data);
export const cancelSentRequest = (receiver_id) =>
  api.delete(`/friends/cancel/${receiver_id}`).then(r => r.data);

// ---------------------------------------------------------------
// Report Issue
// ---------------------------------------------------------------
export const reportIssue = ({ category, description, movie_id }) =>
  api.post('/report-issue', { category, description: description || undefined, movie_id: movie_id || undefined });

// ---------------------------------------------------------------
// TMDB image helper
// ---------------------------------------------------------------
// Pass through locally-served trailer frames (start with /frames/) or any
// absolute URL unchanged. Otherwise treat the path as a TMDB relative path.
export const tmdbImage = (path, size = 'w500') => {
  if (!path) return null;
  if (path.startsWith('/frames/') || path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
};

export default api;
