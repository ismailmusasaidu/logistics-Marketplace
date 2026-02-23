import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '@/lib/supabase';
import { coreBackend } from '@/lib/coreBackend';
import { useLocation } from '@/hooks/useLocation';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'customer' | 'rider' | 'vendor' | 'admin', phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  locationAddress: string | null;
  locationPermissionDenied: boolean;
  locationLoading: boolean;
  refreshLocation: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { locationState, requestAndSaveLocation, loadSavedLocation } = useLocation();
  const isSigningIn = React.useRef(false);
  const initialLoadDone = React.useRef(false);

  useEffect(() => {
    coreBackend.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).then(() => {
          initialLoadDone.current = true;
        });
      } else {
        initialLoadDone.current = true;
        setLoading(false);
      }
    }).catch(() => {
      initialLoadDone.current = true;
      setLoading(false);
    });

    const { data: { subscription } } = coreBackend.auth.onAuthStateChange((event, session) => {
      if (isSigningIn.current) return;
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setSession(session);
        setUser(session.user);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          (async () => {
            await loadProfile(session.user.id);
          })();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string, requestLocation = false) => {
    try {
      const { data, error } = await coreBackend
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);

      if (data?.role === 'customer') {
        if (requestLocation) {
          requestAndSaveLocation(userId);
        } else {
          loadSavedLocation(data);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    isSigningIn.current = true;
    try {
      const { data, error } = await coreBackend.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (data?.session && data?.user) {
        setSession(data.session);
        setUser(data.user);
        await loadProfile(data.user.id, true);
      }
    } finally {
      isSigningIn.current = false;
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: 'customer' | 'rider' | 'vendor' | 'admin', phone?: string) => {
    const { data, error } = await coreBackend.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          phone,
        },
        emailRedirectTo: undefined,
      },
    });

    if (error) throw error;
    if (data?.session && data?.user) {
      setSession(data.session);
      setUser(data.user);
    }
    if (data?.user && role === 'customer') {
      requestAndSaveLocation(data.user.id);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await coreBackend.auth.signOut();
      if (error && error.message !== 'Auth session missing!') {
        throw error;
      }
    } catch (error) {
      console.error('Error during sign out', error);
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await loadProfile(user.id);
    }
  };

  const refreshLocation = async () => {
    if (user?.id) {
      await requestAndSaveLocation(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        locationAddress: locationState.address,
        locationPermissionDenied: locationState.permissionDenied,
        locationLoading: locationState.loading,
        refreshLocation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
