"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Volume2 } from "lucide-react";
import { eawsApi } from "@/lib/api";

interface WebRtcVoiceCallProps {
  incidentId: string;
  callerLabel?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export default function WebRtcVoiceCall({ incidentId, callerLabel = "Citizen" }: WebRtcVoiceCallProps) {
  const [callState, setCallState] = useState<"idle" | "ringing_out" | "ringing_in" | "connected" | "error">("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const roleRef = useRef<"caller" | "callee">("caller");
  const addedIceCountRef = useRef<number>(0);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  function cleanupCall() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    addedIceCountRef.current = 0;
    incomingOfferRef.current = null;
    setDurationSec(0);
    setIsMuted(false);
  }

  useEffect(() => {
    cleanupCall();
    setCallState("idle");
    setErrorMsg(null);
    return () => cleanupCall();
  }, [incidentId]);

  // Duration timer when connected
  useEffect(() => {
    if (callState !== "connected") return;
    const t = setInterval(() => setDurationSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callState]);

  // Poll signaling state every 1.2s
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await eawsApi.getCallState(incidentId);
        const call = res?.call;
        if (!call) return;

        if (call.status === "ended" || call.status === "idle") {
          if (callState !== "idle" && callState !== "error") {
            cleanupCall();
            setCallState("idle");
          }
          return;
        }

        // Detect incoming call from victim while idle
        if (call.status === "ringing" && call.caller_role === "victim" && callState === "idle") {
          incomingOfferRef.current = call.offer;
          setCallState("ringing_in");
          return;
        }

        const pc = pcRef.current;
        if (!pc) return;

        // If we are caller and answer arrived
        if (roleRef.current === "caller" && call.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(call.answer));
          setCallState("connected");
        }

        // Apply remote ICE candidates
        const remoteCandidates =
          roleRef.current === "caller" ? call.callee_candidates || [] : call.caller_candidates || [];
        while (addedIceCountRef.current < remoteCandidates.length) {
          const cand = remoteCandidates[addedIceCountRef.current];
          addedIceCountRef.current++;
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (_) {}
        }
      } catch (_) {}
    }, 1200);

    return () => clearInterval(timer);
  }, [incidentId, callState]);

  async function initPeerConnection(role: "caller" | "callee") {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    roleRef.current = role;
    addedIceCountRef.current = 0;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        eawsApi.sendCallIce(incidentId, role, event.candidate.toJSON()).catch(() => {});
      }
    };

    return pc;
  }

  async function startOutgoingCall() {
    setErrorMsg(null);
    try {
      const pc = await initPeerConnection("caller");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await eawsApi.sendCallOffer(incidentId, {
        offer: { type: offer.type, sdp: offer.sdp },
        caller_role: "dispatcher",
        caller_name: "District Dispatch",
      });
      setCallState("ringing_out");
    } catch (err: any) {
      cleanupCall();
      setCallState("error");
      setErrorMsg(err?.message || "Microphone permission required for VoIP call");
    }
  }

  async function answerIncomingCall() {
    if (!incomingOfferRef.current) return;
    setErrorMsg(null);
    try {
      const pc = await initPeerConnection("callee");
      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await eawsApi.sendCallAnswer(incidentId, { type: answer.type, sdp: answer.sdp });
      setCallState("connected");
    } catch (err: any) {
      cleanupCall();
      setCallState("error");
      setErrorMsg(err?.message || "Failed to answer VoIP call");
    }
  }

  async function handleHangup() {
    try {
      await eawsApi.endCall(incidentId);
    } catch (_) {}
    cleanupCall();
    setCallState("idle");
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !isMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
  }

  const mm = String(Math.floor(durationSec / 60)).padStart(2, "0");
  const ss = String(durationSec % 60).padStart(2, "0");

  return (
    <div className="space-y-1.5">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {callState === "idle" || callState === "error" ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={startOutgoingCall}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Phone size={13} />
            <span>In-App VoIP Call ({callerLabel})</span>
          </button>
          {errorMsg && <p className="text-[10px] text-red-400">{errorMsg}</p>}
        </div>
      ) : callState === "ringing_in" ? (
        <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-500/60 flex items-center justify-between gap-2 animate-pulse">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <PhoneIncoming size={15} />
            <span>Incoming VoIP Call...</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={answerIncomingCall}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-[11px] font-bold text-white"
            >
              Answer
            </button>
            <button
              type="button"
              onClick={handleHangup}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-[11px] font-bold text-white"
            >
              Decline
            </button>
          </div>
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/50 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Volume2 size={15} className="text-blue-400 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-white">
                {callState === "ringing_out" ? "Calling via WebRTC..." : `VoIP Connected • ${mm}:${ss}`}
              </div>
              <div className="text-[10px] text-blue-300 font-mono">Encrypted P2P Audio</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-1.5 rounded border ${
                isMuted ? "bg-amber-600/30 border-amber-500 text-amber-300" : "bg-neutral-800 border-neutral-700 text-neutral-300"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>
            <button
              type="button"
              onClick={handleHangup}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-[11px] font-bold text-white flex items-center gap-1"
            >
              <PhoneOff size={12} /> End
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
