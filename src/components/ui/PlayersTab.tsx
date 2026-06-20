"use client";

import { useState, useEffect } from "react";
import { Search, UserPlus, Play, Check, X, Clock, Link as LinkIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { sendFriendRequest, acceptFriendRequest } from "@/app/actions/friends";

type Profile = {
  id: string;
  username: string;
  rating: number;
};

type Friendship = {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  profiles: Profile;
};

export default function PlayersTab({ currentUserId, onInviteFriend }: { currentUserId: string | null, onInviteFriend: (friend: Profile) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [acceptingFriendId, setAcceptingFriendId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const supabase = createSupabaseBrowserClient();

  useEffect(() => {
    loadSocialData();
    const channel = supabase.channel('friendships_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
        loadSocialData();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const loadSocialData = async () => {
    if (!currentUserId) return;
    
    const { data, error } = await supabase
      .from("friendships")
      .select(`
        user_id, friend_id, status, created_at
      `)
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    if (error || !data) return;

    const accepted = data.filter((f: any) => f.status === "accepted");
    const pendingReceived = data.filter((f: any) => f.status === "pending" && f.friend_id === currentUserId);
    const pendingSent = data.filter((f: any) => f.status === "pending" && f.user_id === currentUserId);

    const neededProfileIds = new Set<string>();
    accepted.forEach((f: any) => neededProfileIds.add(f.user_id === currentUserId ? f.friend_id : f.user_id));
    pendingReceived.forEach((f: any) => neededProfileIds.add(f.user_id));
    pendingSent.forEach((f: any) => neededProfileIds.add(f.friend_id));

    if (neededProfileIds.size === 0) {
      setFriends([]);
      setPendingRequests([]);
      setSentRequests([]);
      return;
    }

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, username, rating")
      .in("id", Array.from(neededProfileIds));

    if (!profilesData) return;
    const profileMap = new Map(profilesData.map((p: any) => [p.id, p]));

    setFriends(accepted.map((f: any) => {
      const otherId = f.user_id === currentUserId ? f.friend_id : f.user_id;
      return { ...f, friendProfile: profileMap.get(otherId) };
    }).filter((f: any) => f.friendProfile));

    setPendingRequests(pendingReceived.map((f: any) => ({
      ...f, 
      senderProfile: profileMap.get(f.user_id)
    })).filter((f: any) => f.senderProfile));

    setSentRequests(pendingSent.map((f: any) => ({
      ...f,
      receiverProfile: profileMap.get(f.friend_id)
    })).filter((f: any) => f.receiverProfile));
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("search_profiles", { search_term: searchQuery });
      if (!error && data) {
        setSearchResults(data.filter((p: Profile) => p.id !== currentUserId));
      }
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUserId]);

  const handleAddFriend = async (friendId: string) => {
    try {
      setAddingFriendId(friendId);
      await sendFriendRequest(friendId);
      await loadSocialData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleAcceptRequest = async (friendId: string) => {
    try {
      setAcceptingFriendId(friendId);
      await acceptFriendRequest(friendId);
      await loadSocialData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to accept request");
    } finally {
      setAcceptingFriendId(null);
    }
  };

  return (
    <div className="flex flex-col h-full gap-6 overflow-hidden max-h-full pb-4 px-2">
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider">Search Players</h2>
          <button
            onClick={() => {
              if (currentUserId) {
                const url = window.location.origin + window.location.pathname + "?tab=players&inviteUser=" + currentUserId;
                navigator.clipboard.writeText(url);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors text-xs font-bold text-[var(--text-primary)]"
            title="Copy link to your profile"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-[var(--cta-bg)]" /> : <LinkIcon className="w-3.5 h-3.5" />}
            {copiedLink ? "Copied!" : "Invite Link"}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl py-3 pl-10 pr-4 text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:font-normal focus:outline-none focus:border-[var(--cta-bg)] transition-colors"
          />
        </div>

        {searchQuery.trim() && (
          <div className="bg-[var(--surface-alt)] border border-[var(--border)] rounded-xl overflow-y-auto max-h-[200px]">
            {isLoading ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">Searching...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map(profile => {
                const isFriend = friends.some((f: any) => f.friendProfile?.id === profile.id);
                const isSent = sentRequests.some((f: any) => f.receiverProfile?.id === profile.id);
                
                return (
                  <div key={profile.id} className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-hover)] transition-colors">
                    <div>
                      <div className="font-bold text-[13px] leading-tight text-[var(--text-primary)]">{profile.username}</div>
                      <div className="text-xs text-[var(--text-secondary)]">Rating: {Math.round(profile.rating)}</div>
                    </div>
                    {isFriend ? (
                      <span className="text-xs text-[var(--text-muted)] font-semibold flex items-center gap-1"><Check className="w-4 h-4"/> Friends</span>
                    ) : isSent ? (
                      <span className="text-xs text-[var(--text-muted)] font-semibold flex items-center gap-1"><Check className="w-4 h-4"/> Requested</span>
                    ) : (
                      <button 
                        onClick={() => handleAddFriend(profile.id)}
                        disabled={addingFriendId === profile.id}
                        className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                        title="Add Friend"
                      >
                        {addingFriendId === profile.id ? (
                          <div className="w-4 h-4 border-2 border-t-transparent border-[var(--text-primary)] rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-[var(--text-primary)]" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">No players found</div>
            )}
          </div>
        )}
      </div>

      <div className="h-[1px] w-full bg-[var(--border)] shrink-0" />

      <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
        {pendingRequests.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Friend Requests</h3>
            {pendingRequests.map(req => (
              <div key={req.user_id} className="flex items-center justify-between px-2 py-1.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg shadow-sm">
                <div>
                  <div className="font-bold text-[13px] leading-tight text-[var(--text-primary)]">{req.senderProfile.username}</div>
                  <div className="text-xs text-[var(--text-secondary)]">Rating: {Math.round(req.senderProfile.rating)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleAcceptRequest(req.user_id)}
                    disabled={acceptingFriendId === req.user_id}
                    className="p-2 rounded-lg bg-[var(--cta-bg)] hover:brightness-110 transition-colors text-white disabled:opacity-50"
                  >
                    {acceptingFriendId === req.user_id ? (
                      <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 pb-4">
          <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">My Friends</h3>
          {friends.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] text-sm">
              You haven't added any friends yet. Use the search bar above to find players!
            </div>
          ) : (
            friends.map(friend => (
              <div key={friend.friendProfile.id} className="flex items-center justify-between px-2 py-1.5 bg-[var(--surface-alt)] border border-[var(--border)] rounded-lg shadow-sm hover:border-[var(--cta-bg)] transition-colors cursor-pointer group" onClick={() => onInviteFriend(friend.friendProfile)}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[var(--surface)] flex items-center justify-center font-bold text-[13px] text-[var(--text-primary)]">
                    {friend.friendProfile.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-[13px] leading-tight text-[var(--text-primary)]">{friend.friendProfile.username}</div>
                    <div className="text-xs text-[var(--text-secondary)]">Rating: {Math.round(friend.friendProfile.rating)}</div>
                  </div>
                </div>
                <button 
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface)] group-hover:bg-[var(--cta-bg)] group-hover:text-white transition-all text-[var(--text-primary)] font-bold text-sm"
                >
                  <Play className="w-3.5 h-3.5" />
                  Play
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
