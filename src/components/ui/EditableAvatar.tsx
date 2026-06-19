"use client";

import { useState, useRef } from "react";
import { Edit2, ShieldCheck, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "react-hot-toast";
import Cropper from "react-easy-crop";
import 'react-easy-crop/react-easy-crop.css';
import { getCroppedImg } from "@/lib/cropImage";

interface EditableAvatarProps {
  userId: string;
  initialAvatarUrl: string | null;
  username: string;
  verified: boolean;
}

export default function EditableAvatar({ userId, initialAvatarUrl, username, verified }: EditableAvatarProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`);
  const [isUploading, setIsUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const reader = new FileReader();
    reader.addEventListener('load', () => setCropSrc(reader.result?.toString() || null));
    reader.readAsDataURL(file);
  };

  const uploadCroppedImage = async () => {
    if (!cropSrc || !croppedAreaPixels) return;

    setIsUploading(true);
    
    try {
      const croppedImage = await getCroppedImg(cropSrc, croppedAreaPixels, 0);
      if (!croppedImage) throw new Error("Failed to crop image");

      const fileExt = 'jpeg';
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedImage, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      toast.success('Profile picture updated!');
      setCropSrc(null);
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
    <>
      <div className="relative inline-block group">
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileSelect}
        />
        <div 
          className="relative cursor-pointer group/avatar inline-block"
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <img
            src={avatarUrl}
            alt={username}
            className={`w-24 h-24 rounded-full object-cover border-4 border-[var(--surface-alt)] shadow-sm transition-opacity ${isUploading ? 'opacity-50' : 'group-hover/avatar:opacity-90'}`}
          />
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
              <Loader2 size={24} className="text-white drop-shadow-md animate-spin" />
            </div>
          ) : (
            <div className="absolute bottom-0 right-0 bg-[var(--text-primary)] text-[var(--bg)] p-1.5 rounded-full border-2 border-[var(--surface)] z-10 shadow-sm hover:scale-110 transition-transform">
              <Edit2 size={14} />
            </div>
          )}
        </div>
        {verified && (
          <div className="absolute bottom-0 left-0 bg-[var(--text-primary)] text-[var(--bg)] p-1 rounded-full border-2 border-[var(--surface)] z-10 pointer-events-none">
            <ShieldCheck size={14} />
          </div>
        )}
      </div>

      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--surface-alt)]">
              <h3 className="font-bold text-[var(--text-primary)]">Crop Profile Picture</h3>
              <button onClick={() => setCropSrc(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <ShieldCheck size={20} className="opacity-0" /> {/* Spacer */}
                Close
              </button>
            </div>
            
            <div className="relative w-full h-[300px] bg-black">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/50 text-white text-sm px-3 py-1 rounded-full pointer-events-none">
                Drag image to adjust
              </div>
              <Cropper
                image={cropSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            
            <div className="p-4 flex flex-col gap-4 bg-[var(--surface-alt)]">
              <div className="flex items-center gap-4">
                <span className="text-[var(--text-secondary)] text-sm">Zoom</span>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[var(--cta-bg)]"
                />
              </div>
              <div className="flex gap-3 justify-end mt-2">
                <button 
                  onClick={() => setCropSrc(null)}
                  className="px-4 py-2 rounded-lg font-bold text-[var(--text-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                <button 
                  onClick={uploadCroppedImage}
                  className="px-4 py-2 rounded-lg font-bold bg-[var(--text-primary)] text-[var(--bg)] hover:bg-[var(--text-secondary)] transition-colors flex items-center gap-2"
                  disabled={isUploading}
                >
                  {isUploading && <Loader2 size={16} className="animate-spin" />}
                  Save Avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
