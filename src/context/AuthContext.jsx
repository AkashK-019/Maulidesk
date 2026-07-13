/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AuthContext = createContext({});

const DEFAULT_FALLBACK_PAGES = ['dashboard', 'projects', 'quotations', 'inventory', 'labour', 'finance'];

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync profile data from profiles table
  const fetchProfile = async (sessionUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sessionUser.id)
        .single();

      if (data) {
        setProfile(data);
      } else {
        // Fallback if profiles row is not found or yet created
        setProfile({
          role: 'Staff',
          full_name: sessionUser.email?.split('@')[0] || 'User',
          allowed_pages: DEFAULT_FALLBACK_PAGES
        });
      }
    } catch {
      setProfile({
        role: 'Staff',
        full_name: sessionUser.email?.split('@')[0] || 'User',
        allowed_pages: DEFAULT_FALLBACK_PAGES
      });
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for Supabase auth session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user);
        await fetchProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login handler
  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      return { data, error };
    } catch (err) {
      return { data: null, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Sign out handler
  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile: () => user && fetchProfile(user) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}