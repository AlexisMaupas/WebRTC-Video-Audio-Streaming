let ws = null;
let peer = null;
let localStream = null;

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

function startConnection() {
    stopConnection(); // Ensure any previous connection is stopped
    console.log('🚀 Starting connection');
    
    // Reinitialize peer and ws
    peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    ws = new WebSocket(`ws://${location.host}`);

    peer.onicecandidate = event => {
        if (event.candidate) {
            console.log('🧊 Sending ICE candidate');
            ws.send(JSON.stringify({ iceCandidate: event.candidate }));
        }
    };

    peer.ontrack = event => {
        console.log('📺 Remote video received');
        remoteVideo.srcObject = event.streams[0];
    };

    ws.onopen = async () => {
        console.log('🔌 Connected to signaling server');
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('🎥 Local video ready');
            localVideo.srcObject = localStream;
            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            console.log('📤 Sending offer');
            ws.send(JSON.stringify({ offer }));
        } catch (err) {
            console.error('❌ Could not access camera or mic', err);
        }
    };

    ws.onmessage = async (msg) => {
        const text = await msg.data.text();
        const data = JSON.parse(text);
        console.log('📥 Message received:', data);

        if (data.offer) {
            console.log('📥 Offer received');
            await peer.setRemoteDescription(data.offer);

            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('🎥 Local video ready (for answer)');
            localVideo.srcObject = localStream;
            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            console.log('📤 Sending answer');
            ws.send(JSON.stringify({ answer }));
        } else if (data.answer) {
            console.log('📥 Answer received');
            await peer.setRemoteDescription(data.answer);
        } else if (data.iceCandidate) {
            console.log('🧊 ICE candidate received');
            await peer.addIceCandidate(data.iceCandidate);
        }
    };

    ws.onerror = () => console.log('⚠️ WebSocket error');
    ws.onclose = () => console.log('🔌 WebSocket closed');
}

function stopConnection() {
    console.log('❌ Stopping connection');

    if (peer) {
        peer.close();
        peer = null;
    }

    if (ws) {
        ws.close();
        ws = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}

document.getElementById('startBtn').addEventListener('click', () => {
    stopConnection();   // Clean up any previous connection
    startConnection();  // Start a fresh one
});