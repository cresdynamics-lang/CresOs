"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

interface VoiceRecording {
  id: string;
  title: string;
  duration: number;
  transcript: string;
  timestamp: string;
  userId: string;
  userName: string;
  status: "processing" | "completed" | "error";
}

interface CallRecording {
  id: string;
  participants: string[];
  duration: number;
  timestamp: string;
  callType: "voice" | "video";
  transcript: string;
  status: "processing" | "completed" | "error";
}

export default function VoicePage() {
  const router = useRouter();
  const { auth, apiFetch, hydrated } = useAuth();
  const canAccessVoice = auth.roleKeys.some((r) => ["admin", "finance"].includes(r));
  const [activeTab, setActiveTab] = useState<"recordings" | "calls" | "transcribe">("recordings");
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [callRecordings, setCallRecordings] = useState<CallRecording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcriptText, setTranscriptText] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hydrated || !auth.accessToken) return;
    if (!canAccessVoice) {
      router.replace("/dashboard");
    }
  }, [hydrated, auth.accessToken, canAccessVoice, router]);

  // Fetch voice recordings
  useEffect(() => {
    if (!auth.accessToken || !canAccessVoice) return;
    
    const fetchRecordings = async () => {
      try {
        const response = await apiFetch("/finance/voice/recordings");
        if (response.ok) {
          const data = await response.json();
          setRecordings(data.data.recordings || []);
        }
      } catch (error) {
        console.error("Failed to fetch recordings:", error);
      }
    };

    fetchRecordings();
  }, [auth.accessToken, apiFetch, canAccessVoice]);

  // Fetch call recordings
  useEffect(() => {
    if (!auth.accessToken || !canAccessVoice) return;
    
    const fetchCallRecordings = async () => {
      try {
        const response = await apiFetch("/finance/voice/calls");
        if (response.ok) {
          const data = await response.json();
          setCallRecordings(data.data.calls || []);
        }
      } catch (error) {
        console.error("Failed to fetch call recordings:", error);
      }
    };

    fetchCallRecordings();
  }, [auth.accessToken, apiFetch, canAccessVoice]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start recording timer
    const timer = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    setRecordingTimer(timer);
  };

  const stopRecording = async () => {
    if (recordingTimer) {
      clearInterval(recordingTimer);
      setRecordingTimer(null);
    }
    
    setIsRecording(false);
    
    // Here you would upload the recording to the server
    console.log("Recording stopped, duration:", recordingTime, "seconds");
    
    // Reset recording time
    setRecordingTime(0);
  };

  const handleTranscribe = async () => {
    if (!transcriptText.trim()) return;
    
    setIsTranscribing(true);
    
    try {
      // Mock transcription API call
      const response = await apiFetch("/finance/voice/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: transcriptText,
          userId: auth.userId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Transcription saved:", data);
        setTranscriptText("");
      }
    } catch (error) {
      console.error("Failed to save transcription:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            title="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-slate-200 mb-2">Voice Center</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Dashboard
          </button>
          <button
            onClick={() => window.location.href = '/community'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Community
          </button>
          <button
            onClick={() => window.location.href = '/finance'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Finance
          </button>
          <button
            onClick={() => window.location.href = '/analytics'}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            Analytics
          </button>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-slate-400">Manage voice recordings, transcriptions, and call analytics for finance operations.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("recordings")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "recordings"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Voice Recordings
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "calls"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Call Recordings
        </button>
        <button
          onClick={() => setActiveTab("transcribe")}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === "transcribe"
              ? "border-b-2 border-brand text-brand"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Transcribe
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "recordings" && (
        <div className="space-y-6">
          {/* Recording Controls */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Voice Recording</h2>
            
            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isRecording
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-brand hover:bg-brand/80 text-white"
                }`}
              >
                {isRecording ? (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    Stop Recording
                  </div>
                ) : (
                  "Start Recording"
                )}
              </button>
              
              {isRecording && (
                <div className="text-xl font-mono text-brand">
                  {formatDuration(recordingTime)}
                </div>
              )}
            </div>
            
            <div className="text-sm text-slate-400">
              {isRecording 
                ? "Recording in progress... Click stop to finish."
                : "Click start to begin recording voice notes for finance discussions."
              }
            </div>
          </div>

          {/* Recordings List */}
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
            <h2 className="text-xl font-semibold text-slate-200 mb-4">Recent Recordings</h2>
            
            {recordings.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="mb-2">🎙️</div>
                <div>No voice recordings yet</div>
              </div>
            ) : (
              <div className="space-y-4">
                {recordings.map((recording) => (
                  <div key={recording.id} className="flex items-start justify-between p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-200">{recording.title}</h3>
                      <p className="text-sm text-slate-400 mb-2">{recording.userName}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Duration: {formatDuration(recording.duration)}</span>
                        <span>{formatTimestamp(recording.timestamp)}</span>
                        <span className={`px-2 py-1 rounded ${
                          recording.status === "completed" ? "bg-green-900 text-green-200" :
                          recording.status === "processing" ? "bg-yellow-900 text-yellow-200" :
                          "bg-red-900 text-red-200"
                        }`}>
                          {recording.status}
                        </span>
                      </div>
                    </div>
                    <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "calls" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Call Recordings</h2>
          
          {callRecordings.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="mb-2">📞</div>
              <div>No call recordings available</div>
            </div>
          ) : (
            <div className="space-y-4">
              {callRecordings.map((call) => (
                <div key={call.id} className="flex items-start justify-between p-4 bg-slate-800/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        call.callType === "video" ? "bg-blue-900 text-blue-200" : "bg-green-900 text-green-200"
                      }`}>
                        {call.callType === "video" ? "📹 Video" : "📞 Voice"}
                      </span>
                      <span className="text-sm text-slate-400">
                        {call.participants.join(" • ")}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 mb-2">{call.transcript}</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>Duration: {formatDuration(call.duration)}</span>
                      <span>{formatTimestamp(call.timestamp)}</span>
                      <span className={`px-2 py-1 rounded ${
                        call.status === "completed" ? "bg-green-900 text-green-200" :
                        call.status === "processing" ? "bg-yellow-900 text-yellow-200" :
                        "bg-red-900 text-red-200"
                      }`}>
                        {call.status}
                      </span>
                    </div>
                  </div>
                  <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "transcribe" && (
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Transcribe Audio</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Audio File or Text to Transcribe
              </label>
              <textarea
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Paste audio transcript text or upload audio file..."
                className="w-full h-32 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-400 focus:outline-none focus:border-brand resize-none"
              />
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleTranscribe}
                disabled={!transcriptText.trim() || isTranscribing}
                className="px-6 py-3 bg-brand hover:bg-brand/80 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isTranscribing ? "Processing..." : "Save Transcription"}
              </button>
              
              <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors">
                Upload Audio File
              </button>
            </div>
            
            <div className="text-sm text-slate-400">
              Transcribe audio recordings for finance meetings, budget discussions, and client calls. 
              AI-powered transcription helps maintain accurate records of important conversations.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
