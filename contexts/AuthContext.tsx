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

  useEffect(() => {
    coreBackend.auth.getSession().then(({ data: { session }, error }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = coreBackend.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
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
    const { data, error } = await coreBackend.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data?.user) {
      await loadProfile(data.user.id, true);
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
