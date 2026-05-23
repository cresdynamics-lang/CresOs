/** WebRTC helpers for Community 1:1 calls */

export const COMMUNITY_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" }
];

if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_TURN_URL) {
  const turn: RTCIceServer = {
    urls: process.env.NEXT_PUBLIC_TURN_URL,
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || undefined,
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || undefined
  };
  COMMUNITY_ICE_SERVERS.push(turn);
}

export function defaultMediaConstraints(callType: "voice" | "video"): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video:
      callType === "video"
        ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          }
        : false
  };
}

export function createCommunityPeerConnection(
  onIceCandidate: (candidate: RTCIceCandidate) => void,
  onRemoteTrack: (stream: MediaStream) => void,
  onConnectionState?: (state: RTCPeerConnectionState) => void
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: COMMUNITY_ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) onIceCandidate(e.candidate);
  };

  pc.ontrack = (e) => {
    const stream = e.streams[0] ?? (e.track ? new MediaStream([e.track]) : null);
    if (stream) onRemoteTrack(stream);
  };

  pc.onconnectionstatechange = () => {
    onConnectionState?.(pc.connectionState);
  };

  return pc;
}

export class IceCandidateQueue {
  private pending: RTCIceCandidateInit[] = [];

  async add(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
    if (pc.remoteDescription) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // ignore stale candidates
      }
      return;
    }
    this.pending.push(candidate);
  }

  async flush(pc: RTCPeerConnection): Promise<void> {
    const list = [...this.pending];
    this.pending = [];
    for (const c of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore
      }
    }
  }

  clear(): void {
    this.pending = [];
  }
}

export async function replaceVideoTrack(
  pc: RTCPeerConnection,
  track: MediaStreamTrack | null
): Promise<void> {
  const sender = pc.getSenders().find((s) => s.track?.kind === "video");
  if (sender) {
    await sender.replaceTrack(track);
    return;
  }
  if (track) {
    pc.addTrack(track);
  }
}

export async function renegotiateCall(
  pc: RTCPeerConnection,
  sendOffer: (sdp: RTCSessionDescriptionInit) => void
): Promise<void> {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendOffer(offer);
}
