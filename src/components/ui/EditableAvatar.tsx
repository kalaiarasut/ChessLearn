"use client";

import { useState, useRef } from "react";
import { Edit2, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";

interface EditableAvatarProps {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
  verified: boolean;
}

export default function EditableAvatar({ userId, initialAvatarUrl, username, verified }: EditableAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative inline-block group">
      <input 
        type="file" 
        accept="image/*" 
        className="hidden" 
        ref={fileInputRef}
        onChange={handleUpload}
      />
      <div 
        className="relative cursor-pointer"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <img
          src={avatarUrl}
          alt={username}
          className={`w-24 h-24 rounded-full object-cover border-4 border-[var(--surface-alt)] shadow-sm transition-opacity ${isUploading ? 'opacity-50' : 'group-hover:opacity-80'}`}
        />
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity bg-black/40 rounded-full ${isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {isUploading ? (
            <Loader2 size={24} className="text-white drop-shadow-md animate-spin" />
          ) : (
            <Edit2 size={24} className="text-white drop-shadow-md" />
          )}
        </div>
      </div>
      {verified && (
        <div className="absolute bottom-0 right-0 bg-[var(--text-primary)] text-[var(--bg)] p-1 rounded-full border-2 border-[var(--surface)] z-10 pointer-events-none">
          <ShieldCheck size={14} />
        </div>
      )}
    </div>
  );
}
