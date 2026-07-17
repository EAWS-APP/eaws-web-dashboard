"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Mail,
  User,
  Phone,
  ScanFace,
  CreditCard,
  Camera,
  CheckCircle,
  X,
  Lock,
  Loader2,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { eawsApi } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  // Screen routing state: 'login' | 'register' | 'email-verification' | 'operator-check'
  const [activeScreen, setActiveScreen] = useState<'login' | 'register' | 'email-verification' | 'operator-check'>('login');

  // Input states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Citizen Registration details
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [ghanaCard, setGhanaCard] = useState("");
  const [cardImage, setCardImage] = useState<string | null>(null);
  const [isLivenessScanning, setIsLivenessScanning] = useState(false);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  // Verification codes
  const [emailCode, setEmailCode] = useState("");
  const [operatorCode, setOperatorCode] = useState("");

  // Temp storage for multi-stage authentication
  const [tempEmail, setTempEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [tempRole, setTempRole] = useState("");
  const [tempDashboardPath, setTempDashboardPath] = useState("");
  const [tempCorrectOperatorCode, setTempCorrectOperatorCode] = useState("");

  // Feedback states
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear errors when switching screens
  useEffect(() => {
    setError("");
    setSuccess("");
  }, [activeScreen]);

  // Simulate selfie facial liveness scan
  function handleSelfieScan() {
    setIsLivenessScanning(true);
    setError("");
    setTimeout(() => {
      setIsLivenessScanning(false);
      setSelfieImage("captured-selfie-thumbnail");
    }, 2500);
  }

  // Ghana Card image file selection mock
  function handleCardFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setCardImage(e.target.files[0].name);
      if (!ghanaCard) {
        setGhanaCard("GHA-" + Math.floor(100000000 + Math.random() * 900000000) + "-1");
      }
    }
  }

  // Sign In Flow (Unified)
  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    if (!email || !password) {
      setError("Email and password are required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      // Resolve user's actual profile from the backend API
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;

      if (!token) {
        throw new Error("Authorization token was not issued by Supabase.");
      }

      const apiResponse = await fetch("http://127.0.0.1:5000/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!apiResponse.ok) {
        const errText = await apiResponse.text();
        throw new Error(errText || "Error resolving profile credentials from backend.");
      }

      const meData = await apiResponse.json();
      const role = meData.profile?.user_role || "citizen";
      const code = meData.profile?.operator_code || "";
      const isApproved = meData.profile?.is_approved !== false;
      const isActive = meData.profile?.is_active !== false;

      // 1. Verify status
      if (!isApproved || !isActive) {
        throw new Error("Your account is pending approval or has been deactivated.");
      }

      // 2. Redirect citizens directly to simulated app
      if (role === "citizen") {
        setIsSubmitting(false);
        router.push("/citizen");
        return;
      }

      // 3. For admins/super_admins, skip code verification and enter dashboard directly
      if (role === "admin" || role === "super_admin") {
        setIsSubmitting(false);
        router.push("/admin");
        return;
      }

      // 4. For operators, transition to Stage 2: Security Code verification
      setTempEmail(email);
      setTempRole(role);
      setTempCorrectOperatorCode(code);

      let targetPath = "/dashboard";
      if (role === "police") targetPath = "/police";
      else if (role === "ambulance") targetPath = "/ambulance";
      else if (role === "fire") targetPath = "/fire";
      else if (role === "nadmo") targetPath = "/nadmo";

      setTempDashboardPath(targetPath);
      setOperatorCode("");
      setIsSubmitting(false);
      setActiveScreen("operator-check");
    } catch (err: any) {
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setError(err.message || "Failed to authenticate operator credentials.");
    }
  }

  // Operator Stage-2 Security Code Check Submission
  async function handleOperatorCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (!operatorCode) {
      setError("Please enter your assigned security badge/unit code.");
      setIsSubmitting(false);
      return;
    }

    try {
      if (operatorCode.trim().toLowerCase() !== tempCorrectOperatorCode.toLowerCase()) {
        throw new Error(`Invalid security code. Please match the code sent to your email. (Hint: ${tempCorrectOperatorCode})`);
      }

      // Proceed to the dashboard
      setIsSubmitting(false);
      router.push(tempDashboardPath);
    } catch (err: any) {
      await supabase.auth.signOut();
      setIsSubmitting(false);
      setError(err.message);
    }
  }

  // Sign Up Flow
  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    if (!fullName || !email || !password || !phone || !ghanaCard) {
      setError("All credentials and card scans are required.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }

    if (!cardImage) {
      setError("Ghana Card photo upload is required.");
      setIsSubmitting(false);
      return;
    }

    if (!selfieImage) {
      setError("Facial liveness verification is required.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await eawsApi.signup({
        email,
        password,
        phone,
        metadata: {
          full_name: fullName,
          phone_number: phone,
          ghana_card: ghanaCard,
        },
      });

      if (!res.success) {
        throw new Error("Failed to register profile.");
      }

      // Transition to Stage 2 Email OTP Verification
      setTempEmail(email);
      setTempPassword(password);
      setEmailCode("");
      setIsSubmitting(false);
      setActiveScreen("email-verification");
    } catch (err: any) {
      setError(err.message || "Failed to register profile.");
      setIsSubmitting(false);
    }
  }

  // Email Code Verification Submission
  async function handleEmailVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    if (emailCode.length !== 8) {
      setError("Email verification code must be exactly 8 characters.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Call backend to programmatically activate the email
      await eawsApi.verifyEmail(tempEmail, emailCode);

      // Auto login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: tempEmail,
        password: tempPassword,
      });

      if (signInError) throw signInError;

      setIsSubmitting(false);
      router.push("/citizen");
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row font-sans">
      
      {/* Side branding */}
      <div className="relative w-full md:w-1/2 bg-neutral-900 flex flex-col justify-between p-8 lg:p-16 overflow-hidden border-r border-neutral-800 shrink-0">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-red-600/10 blur-[100px]" />
          <div className="absolute bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px]" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 text-red-500 mb-12">
            <ShieldAlert size={36} />
            <span className="text-2xl font-bold tracking-wider text-white">
              EAWS <span className="font-light text-neutral-400">Control</span>
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
            Ghana Emergency Alert & Warning System
          </h1>
          <p className="text-neutral-400 text-lg max-w-md leading-relaxed">
            National platform linking citizens, dispatch centers, and emergency response agencies to protect and coordinate in real-time.
          </p>
        </div>

        <div className="relative z-10 mt-12 md:mt-0">
          <div className="flex items-center gap-4 text-sm text-neutral-500">
            <span>Secure TLS 1.3</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>Operational Layer Active</span>
          </div>
        </div>
      </div>

      {/* Main Forms Interface Area */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 lg:p-16 bg-neutral-950 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          
          {/* Header titles */}
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">
              {activeScreen === "login" && "Sign In"}
              {activeScreen === "register" && "Register Account"}
              {activeScreen === "email-verification" && "Verify Email Address"}
              {activeScreen === "operator-check" && "Operator Security Check"}
            </h2>
            <p className="text-neutral-400 text-sm">
              {activeScreen === "login" && "Enter your email and password to connect."}
              {activeScreen === "register" && "Join EAWS to stay protected and receive live alerts."}
              {activeScreen === "email-verification" && `Enter the 8-character code sent to ${tempEmail}`}
              {activeScreen === "operator-check" && "Verify your assigned operational badge/unit code."}
            </p>
          </div>

          {/* Form toggles */}
          {activeScreen === "login" && (
            <div className="flex justify-end text-xs">
              <button
                onClick={() => setActiveScreen("register")}
                className="text-red-400 hover:text-red-300 font-semibold underline decoration-dotted"
              >
                No account? Register here
              </button>
            </div>
          )}
          {activeScreen === "register" && (
            <div className="flex justify-end text-xs">
              <button
                onClick={() => setActiveScreen("login")}
                className="text-red-400 hover:text-red-300 font-semibold underline decoration-dotted"
              >
                Already registered? Sign in here
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              {success}
            </p>
          )}

          {/* 1. Login Screen */}
          {activeScreen === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="login-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Mail size={16} />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="login-pass">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <KeyRound size={16} />
                  </span>
                  <input
                    id="login-pass"
                    type="password"
                    required
                    placeholder="Enter password"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. Operator Stage-2 Check Screen */}
          {activeScreen === "operator-check" && (
            <form onSubmit={handleOperatorCodeSubmit} className="space-y-4">
              <div className="rounded-lg bg-neutral-900 border border-neutral-800 p-4 space-y-2 text-xs">
                <p className="font-semibold text-white">Verification Profile Detected</p>
                <p className="text-neutral-400">Role: <span className="font-bold text-teal-400 capitalize">{tempRole}</span></p>
                <p className="text-neutral-400">Account: <span className="font-mono text-neutral-200">{tempEmail}</span></p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="operator-code-input">
                  Assigned Security Code (Badge / Unit ID)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Lock size={16} />
                  </span>
                  <input
                    id="operator-code-input"
                    type="text"
                    required
                    placeholder="e.g. POL-0021"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all font-mono tracking-widest"
                    value={operatorCode}
                    onChange={(e) => setOperatorCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    supabase.auth.signOut();
                    setActiveScreen("login");
                  }}
                  className="flex-1 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-bold py-3.5 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Verify Code</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </form>
          )}

          {/* 3. Register Screen */}
          {activeScreen === "register" && (
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-name">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <User size={16} />
                  </span>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    placeholder="e.g. Kwame Mensah"
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-phone">
                  Phone Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Phone size={16} />
                  </span>
                  <input
                    id="signup-phone"
                    type="tel"
                    required
                    placeholder="e.g. +233266241278"
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all font-mono"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Ghana Card Field with scanning toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-card">
                  Ghana Card Number
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <CreditCard size={16} />
                  </span>
                  <input
                    id="signup-card"
                    type="text"
                    required
                    placeholder="GHA-719302941-2"
                    className="w-full pl-10 pr-12 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all font-mono"
                    value={ghanaCard}
                    onChange={(e) => setGhanaCard(e.target.value)}
                  />
                  {/* Mock scanner trigger */}
                  <label className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer">
                    <span className="p-1 rounded bg-neutral-800 border border-neutral-750 hover:bg-neutral-750 text-red-500 transition-colors">
                      <Camera size={15} />
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCardFileChange}
                    />
                  </label>
                </div>
                <p className="text-[10px] text-neutral-500">
                  {cardImage ? (
                    <span className="text-green-400 font-semibold flex items-center gap-1">
                      <CheckCircle size={10} /> Card Attached ({cardImage})
                    </span>
                  ) : (
                    "Scan card via camera or select a photo of your card."
                  )}
                </p>
              </div>

              {/* Mock facial liveness selfie check */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400">Facial Liveness Verification</label>
                <button
                  type="button"
                  onClick={handleSelfieScan}
                  disabled={isLivenessScanning || !!selfieImage}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-sm transition-all ${
                    selfieImage
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : isLivenessScanning
                      ? "bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed"
                      : "bg-neutral-900 border-neutral-850 hover:border-neutral-700 text-neutral-300"
                  }`}
                >
                  {isLivenessScanning ? (
                    <RefreshCw size={20} className="animate-spin text-red-400" />
                  ) : selfieImage ? (
                    <CheckCircle size={20} className="text-green-400 shrink-0" />
                  ) : (
                    <ScanFace size={20} className="text-red-500 shrink-0" />
                  )}
                  <div className="text-left">
                    <p className="font-bold text-xs">
                      {isLivenessScanning ? "Scanning face liveness..." : selfieImage ? "Facial Match Verified" : "Capture Selfie Liveness Check"}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {isLivenessScanning ? "Looking straight at camera, processing..." : selfieImage ? "Liveness check successfully matched with Ghana Card." : "Prove liveness via front-facing camera."}
                    </p>
                  </div>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-email">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <Mail size={16} />
                  </span>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-pass">
                    Password
                  </label>
                  <input
                    id="signup-pass"
                    type="password"
                    required
                    placeholder="Min 6 chars"
                    className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400" htmlFor="signup-confirm-pass">
                    Confirm Password
                  </label>
                  <input
                    id="signup-confirm-pass"
                    type="password"
                    required
                    placeholder="Repeat password"
                    className="w-full px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-lg text-xs text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Uploading credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Register Account</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* 4. Email OTP Verification Screen */}
          {activeScreen === "email-verification" && (
            <form onSubmit={handleEmailVerifySubmit} className="space-y-4">
              <div className="bg-neutral-900/60 border border-neutral-850 rounded-xl p-5 text-sm leading-relaxed space-y-2 text-neutral-300">
                <p>We have sent a secure **8-character** confirmation code to your registered email **{tempEmail}**.</p>
                <p className="text-xs text-neutral-400 mt-2 bg-neutral-950/40 p-3 rounded-lg border border-neutral-800/80">
                  💡 <strong>Tip:</strong> If you do not see the verification code in your inbox within a minute, please check your <strong>Spam</strong> or <strong>Junk</strong> mail folders.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400" htmlFor="email-verify-code">
                  Enter 8-Character Verification Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                    <KeyRound size={16} />
                  </span>
                  <input
                    id="email-verify-code"
                    type="text"
                    required
                    maxLength={8}
                    placeholder="--------"
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-lg text-sm text-white placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-500 transition-all font-mono tracking-[0.2em] text-center font-bold"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Activating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Activate</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="pt-6 border-t border-neutral-800 text-center text-xs text-neutral-500">
            <p>Protected by the Data Protection Act 2012 (Ghana)</p>
            <p className="mt-1">Unauthorized access is strictly prohibited.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
