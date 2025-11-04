import { AdminUser, AdminPermissions, Comment } from './types';

export const formatRelativeTime = (isoDateString: string): string => {
  const date = new Date(isoDateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30.44); // Average month length
  const years = Math.round(days / 365.25); // Account for leap years

  if (seconds < 5) {
    return "just now";
  } else if (seconds < 60) {
    return `${seconds} seconds ago`;
  } else if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  } else if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (days < 7) {
    return days === 1 ? "yesterday" : `${days} days ago`;
  } else if (weeks < 5) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  } else if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  } else {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
};

// --- User & Comment Management Utilities ---

const USERNAMES_STORAGE_KEY = 'zackhub-usernames';
const CURRENT_USER_STORAGE_KEY = 'zackhub-username';

export const getUsername = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to get username from localStorage", e);
    return null;
  }
}

export const getAllRegisteredUsernames = (): string[] => {
  try {
    const storedUsernames = localStorage.getItem(USERNAMES_STORAGE_KEY);
    return storedUsernames ? JSON.parse(storedUsernames) : [];
  } catch (e) {
    console.error("Failed to get registered usernames", e);
    return [];
  }
};

export const isUsernameTaken = (name: string): boolean => {
  const usernames = getAllRegisteredUsernames();
  return usernames.some(username => username.toLowerCase() === name.toLowerCase());
};

export const registerUsername = (name: string): boolean => {
  try {
    if (isUsernameTaken(name)) {
      console.error("Attempted to register a username that is already taken.");
      return false;
    }
    const usernames = getAllRegisteredUsernames();
    const updatedUsernames = [...usernames, name];
    localStorage.setItem(USERNAMES_STORAGE_KEY, JSON.stringify(updatedUsernames));
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, name);
    return true;
  } catch (e) {
    console.error("Failed to register username in localStorage", e);
    return false;
  }
};

export const getAllCommentsFromStorage = (): Array<Comment & { movieId: string }> => {
  const allComments: Array<Comment & { movieId: string }> = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('zackhub-comments-')) {
            const movieId = key.replace('zackhub-comments-', '');
            const comments: Comment[] = JSON.parse(localStorage.getItem(key) || '[]');
            comments.forEach(comment => {
                allComments.push({ ...comment, movieId });
            });
        }
    }
  } catch (e) {
    console.error("Failed to get all comments from storage", e);
  }
  return allComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// --- Profanity Filter ---
const englishProfanity = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'bastard', 'whore'];
const hindiProfanity = [
  'bhenchod', 'behenchod', 'madarchod', 'chutiya', 'chutiye', 'gaandu', 'randi', 
  'bhosdike', 'bhosda', 'chod', 'lund', 'lauda', 'kutta', 'kamina', 'harami'
];

const profanityList = [...englishProfanity, ...hindiProfanity];

export const containsProfanity = (text: string): boolean => {
  const lowerCaseText = text.toLowerCase();
  for (const word of profanityList) {
    // Use word boundaries (\b) to avoid matching parts of words (e.g., 'ass' in 'class')
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(lowerCaseText)) {
      return true;
    }
  }
  return false;
};

export const deleteCommentFromStorage = (movieId: string, commentId: string): boolean => {
  const storageKey = `zackhub-comments-${movieId}`;
  try {
    const storedComments = localStorage.getItem(storageKey);
    if (!storedComments) return false;
    
    let comments: Comment[] = JSON.parse(storedComments);
    const initialLength = comments.length;

    // Check if the comment to delete actually exists
    if (!comments.some(c => c.id === commentId)) {
        return false;
    }
    
    const idsToDelete = new Set<string>();
    const findDescendants = (id: string) => {
      idsToDelete.add(id);
      comments
        .filter(comment => comment.parentId === id)
        .forEach(child => {
            // Check to prevent infinite loops on corrupted data
            if (!idsToDelete.has(child.id)) {
                findDescendants(child.id);
            }
        });
    };

    findDescendants(commentId);

    const updatedComments = comments.filter(c => !idsToDelete.has(c.id));
    
    // Only return true if something was actually deleted.
    if (updatedComments.length < initialLength) {
      localStorage.setItem(storageKey, JSON.stringify(updatedComments));
      return true;
    }
    return false;
    
  } catch (e) {
    console.error(`Failed to delete comment ${commentId} for movie ${movieId}`, e);
    return false;
  }
};

// --- Admin Management Utilities ---

const ADMINS_STORAGE_KEY = 'zackhub-admins';

const defaultPermissions: AdminPermissions = {
    canAddContent: true,
    canEditContent: true,
    canDeleteContent: true,
    canManageComments: true,
    canLiveEdit: false,
};

export const getAdmins = (): AdminUser[] => {
  try {
    const storedAdmins = localStorage.getItem(ADMINS_STORAGE_KEY);
    if (!storedAdmins) return [];
    
    // For backward compatibility, add default permissions if they don't exist
    const admins: AdminUser[] = JSON.parse(storedAdmins);
    return admins.map(admin => ({
        ...admin,
        permissions: { ...defaultPermissions, ...admin.permissions }
    }));

  } catch (e) {
    console.error("Failed to get admins from localStorage", e);
    return [];
  }
};

export const addAdmin = (newUser: Omit<AdminUser, 'permissions'>): { success: boolean; message: string } => {
  try {
    const admins = getAdmins();
    if (admins.some(admin => admin.username.toLowerCase() === newUser.username.toLowerCase()) || newUser.username.toLowerCase() === 'enayat78') {
      return { success: false, message: "Username already exists." };
    }
    const adminWithPermissions: AdminUser = {
        ...newUser,
        permissions: defaultPermissions,
    };
    const updatedAdmins = [...admins, adminWithPermissions];
    localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(updatedAdmins));
    return { success: true, message: "Admin added successfully." };
  } catch (e) {
    console.error("Failed to add admin to localStorage", e);
    return { success: false, message: "An error occurred while saving." };
  }
};

export const removeAdmin = (username: string): boolean => {
  try {
    const admins = getAdmins();
    const updatedAdmins = admins.filter(admin => admin.username.toLowerCase() !== username.toLowerCase());
    if (admins.length === updatedAdmins.length) {
        return false; // User not found
    }
    localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(updatedAdmins));
    return true;
  } catch (e) {
    console.error("Failed to remove admin from localStorage", e);
    return false;
  }
};

export const updateAdminPermissions = (username: string, permissions: AdminPermissions): boolean => {
    try {
        const admins = getAdmins();
        const adminIndex = admins.findIndex(admin => admin.username.toLowerCase() === username.toLowerCase());
        if (adminIndex === -1) {
            return false; // Admin not found
        }
        admins[adminIndex].permissions = permissions;
        localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(admins));
        return true;
    } catch (e) {
        console.error("Failed to update admin permissions", e);
        return false;
    }
};