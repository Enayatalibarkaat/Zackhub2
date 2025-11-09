import { AdminUser, AdminPermissions, Comment } from './types';

export const formatRelativeTime = (isoDateString: string): string => {
  const date = new Date(isoDateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const months = Math.round(days / 30.44);
  const years = Math.round(days / 365.25);

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

// --- Username: JSONBin-based Registration ---

export async function checkAndRegisterUsername(username: string): Promise<string | null> {
  try {
    const response = await fetch(`/.netlify/functions/checkUsername`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (response.status === 409) {
      return "Username already taken.";
    }

    if (!response.ok) {
      return "Something went wrong, please try again.";
    }

    localStorage.setItem('zackhub-username', username);
    return null;
  } catch (err) {
    console.error("Error registering username:", err);
    return "Network error, try again later.";
  }
}

export const getUsername = (): string | null => {
  try {
    return localStorage.getItem('zackhub-username');
  } catch (e) {
    console.error("Failed to get username from localStorage", e);
    return null;
  }
};

// Dummy function to avoid UI errors
export const isUsernameTaken = (_: string): boolean => false;

// --- Comments Storage ---

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
  return profanityList.some(word => new RegExp(`\\b${word}\\b`, 'i').test(lowerCaseText));
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
        return false;
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
          return false;
      }
      admins[adminIndex].permissions = permissions;
      localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(admins));
      return true;
  } catch (e) {
      console.error("Failed to update admin permissions", e);
      return false;
  }
};
