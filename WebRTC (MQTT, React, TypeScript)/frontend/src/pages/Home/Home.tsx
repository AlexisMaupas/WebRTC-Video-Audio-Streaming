import { useState, useRef, useEffect } from "react";
import mqtt from "mqtt";
import "./home.css";

const MQTT_BROKER_URL = "ws://localhost:8888";

function Home() {

  const [room, setRoom] = useState("");
  const [connected, setConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<mqtt.MqttClient | null>(null);

  useEffect(() => {
    clientRef.current = mqtt.connect(MQTT_BROKER_URL);

    clientRef.current.on("connect", () => {
      console.log("✅ Connected to MQTT broker");
    });

    clientRef.current.on("error", (err) => {
      console.error("❌ MQTT error", err);
    });

    return () => {
      clientRef.current?.end();
    };
  }, []);

  const startConnection = async () => {
    if (!room.trim()) {
      alert("Please enter a room ID");
      return;
    }
    stopConnection();

    const client = clientRef.current!;
    peerRef.current =  new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    client.subscribe(`room/${room}`);

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        client.publish(
          `room/${room}`,
          JSON.stringify({ iceCandidate: event.candidate, from: clientRef.current?.options.clientId })
        );
      }
    };

    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    client.on("message", async (_, payload) => {
      try {
        const data = JSON.parse(payload.toString());
        if (!peerRef.current) return;
        if( clientRef.current?.options.clientId === data.from ) return;
        if (data.offer) {

            await peerRef.current.setRemoteDescription(data.offer);

            const localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            localStreamRef.current = localStream;
            if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

            localStream.getTracks().forEach((track) =>
                peerRef.current!.addTrack(track, localStream)
            );

            const answer = await peerRef.current.createAnswer();
            await peerRef.current.setLocalDescription(answer);
            client.publish(`room/${room}`, JSON.stringify({ answer, from: clientRef.current?.options.clientId }));
        } else if (data.answer) {
            await peerRef.current.setRemoteDescription(data.answer);
        } else if (data.iceCandidate) {
          await peerRef.current.addIceCandidate(data.iceCandidate);
        }
      } catch (err) {
        console.error("Error handling MQTT message", err);
      }
    });

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = localStream;
      if (localVideoRef.current) localVideoRef.current.srcObject = localStream;

      localStream.getTracks().forEach((track) =>
        peerRef.current!.addTrack(track, localStream)
      );

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      client.publish(`room/${room}`, JSON.stringify({ offer, from: clientRef.current?.options.clientId }));

      setConnected(true);
    } catch (err) {
      alert("❌ Could not access camera or mic");
      console.error(err);
    }
  };

  function stopConnection() {
    setConnected(false);

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if(clientRef.current) {
        clientRef.current.unsubscribe(`room/${room}`);
        clientRef.current.removeAllListeners();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {track.stop();});
      localStreamRef.current = null;
    }
  
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }

  return (
    <div className="call-page">
      <h1 className="page-title">WebRTC Streaming via MQTT</h1>

      <div className="top-bar">
        <input
          type="text"
          placeholder="Room ID"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          disabled={connected}
          className="room-input"
        />
        <button
          onClick={connected ? stopConnection : startConnection}
          className={`connect-btn ${connected ? "stop" : "start"}`}
        >
          {connected ? "Stop" : "Start"}
        </button>
      </div>

      <div className="videos">
        <div className="video-block">
          <h2>Local</h2>
          <video ref={localVideoRef} autoPlay muted playsInline />
        </div>
        <div className="video-block">
          <h2>Remote</h2>
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
      </div>
    </div>
  );
}

export default Home;
