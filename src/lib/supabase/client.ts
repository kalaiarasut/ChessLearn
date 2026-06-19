import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

export function createSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    // Return a new instance if somehow called on server, though it shouldn't be
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  
  if ((window as any)._supabaseClient) {
    return (window as any)._supabaseClient;
  }
  
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
  (window as any)._supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Provide a dummy lock to prevent Next.js lock stealing errors across tabs/refreshes
      lock: async (name: string, acquireTimeout: number, callback: () => Promise<any>) => {
        return callback();
      }
    }
  });
  return (window as any)._supabaseClient;
}
