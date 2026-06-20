"use client";
import { useState } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Eye, EyeOff, CheckCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
    } else {
      setStatus("success");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white opacity-[0.02] blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

      {/* Auth Card */}
      <div className="w-full max-w-md relative z-10">
        {/* Logo/Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block text-[32px] font-serif font-[800] text-white tracking-normal hover:scale-105 transition-transform duration-300">
            CHESS
          </Link>
          <p className="text-[#adadad] mt-3 font-medium text-[15px]">Create new password</p>
        </div>

        {/* Form Container */}
        <div className="bg-[#121212] border border-[#2b2b2b] rounded-3xl p-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#525252] to-transparent opacity-50" />

          {status === "success" ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#333]">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Password Updated!</h2>
              <p className="text-[#888888] text-[15px] leading-relaxed mb-8">
                Your password has been successfully reset.
              </p>
              <Link href="/learn" className="inline-flex items-center justify-center space-x-2 bg-white text-[#161616] rounded-xl py-3 px-8 font-bold text-[15px] hover:bg-gray-200 transition-all duration-300">
                Go to Dashboard
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Password Input */}
              <div className="space-y-2 text-left">
                <label className="text-[13px] font-semibold text-[#888888] uppercase tracking-wider pl-1">
                  New Password
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-4 text-[#666666] group-focus-within:text-white transition-colors duration-300">
                    <Lock className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333333] text-white rounded-xl pl-12 pr-12 py-4 focus:outline-none focus:border-[#ffffff] focus:ring-1 focus:ring-white transition-all duration-300 placeholder:text-[#444444] text-[15px] tracking-widest"
                    required
                    disabled={status === "loading"}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-[#666666] hover:text-white transition-colors duration-300 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {status === "error" && (
                <div className="text-red-500 text-sm pl-1">{errorMessage}</div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full flex items-center justify-center space-x-2 bg-white text-[#161616] rounded-xl py-4 mt-6 font-bold text-[16px] hover:bg-gray-200 transition-all duration-300 group/btn disabled:opacity-50"
              >
                <span>{status === "loading" ? "Updating..." : "Update Password"}</span>
                {status !== "loading" && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform duration-300" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
