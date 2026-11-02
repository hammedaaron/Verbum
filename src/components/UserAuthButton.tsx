import React, { useState, useRef, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Cloud, CloudCheck, LogOut, UploadCloud, Check, User as UserIcon } from 'lucide-react';
import { signInWithGoogle, logOut } from '../services/firebase';

interface UserAuthButtonProps {
  currentUser: User | null;
  cloudSyncStatus: 'synced' | 'syncing' | 'offline' | 'idle';
  onSyncAllLocalToCloud?: () => Promise<void>;
}

export const UserAuthButton: React.FC<UserAuthButtonProps> = ({
  currentUser,
  cloudSyncStatus,
  onSyncAllLocalToCloud,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
      setIsOpen(false);
    } catch (error: any) {
      // User closed popup or cancelled
      if (error?.code !== 'auth/popup-closed-by-user') {
        console.error('Google sign in error:', error);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      setIsOpen(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleSyncLocal = async () => {
    if (!onSyncAllLocalToCloud) return;
    try {
      setIsSyncing(true);
      await onSyncAllLocalToCloud();
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 hover:bg-neutral-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 transition font-medium text-xs border border-neutral-200/60 dark:border-white/10"
        title="Sign in with your Google account to enable private cloud storage"
      >
        {/* Google 'G' icon */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="hidden sm:inline">Sign In</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 transition group"
        title={`${currentUser.displayName || currentUser.email} — Cloud Storage Connected`}
      >
        {currentUser.photoURL ? (
          <img
            src={currentUser.photoURL}
            alt={currentUser.displayName || 'User'}
            className="w-5 h-5 rounded-full object-cover ring-1 ring-amber-500/50"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-[10px]">
            {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
          </div>
        )}
        <div className="relative flex items-center">
          {cloudSyncStatus === 'syncing' ? (
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          ) : (
            <CloudCheck size={13} className="text-emerald-500 dark:text-emerald-400" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#1c1c1e] border border-neutral-200 dark:border-white/15 rounded-xl shadow-2xl p-3.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
          {/* User Profile Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-neutral-200/80 dark:border-white/10">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-500/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm">
                {(currentUser.displayName || currentUser.email || 'A')[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-neutral-900 dark:text-white truncate text-[13px]">
                {currentUser.displayName || 'Author'}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {currentUser.email}
              </div>
            </div>
          </div>

          {/* Cloud Storage Status */}
          <div className="py-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                <Cloud size={13} className="text-emerald-500" />
                Cloud Database
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Connected & Private
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500 leading-relaxed">
              Every change is automatically saved to your private cloud storage under your Google account.
            </div>
          </div>

          {/* Sync Local Drafts Button */}
          {onSyncAllLocalToCloud && (
            <div className="pt-2 border-t border-neutral-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={handleSyncLocal}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-neutral-100 hover:bg-neutral-200/70 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 font-medium transition text-xs disabled:opacity-50"
              >
                {syncSuccess ? (
                  <>
                    <Check size={13} className="text-emerald-500" />
                    <span>All Drafts Synced!</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={13} className={isSyncing ? 'animate-bounce' : ''} />
                    <span>{isSyncing ? 'Syncing…' : 'Sync All Drafts to Cloud'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Sign Out Button */}
          <div className="pt-2.5 mt-2 border-t border-neutral-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition font-medium text-xs"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
