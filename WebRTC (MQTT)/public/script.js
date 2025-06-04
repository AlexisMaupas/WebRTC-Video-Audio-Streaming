let mqttClient = null;
let peer = null;
let localStream = null;
let room = '';

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const roomInput = document.getElementById('room');


const peerId = 'client-' + Math.random().toString(36).substr(2, 5);
const topicBase = 'webrtc';

function startConnection() {
    stopConnection();

    room = roomInput.value.trim();
    if(!room) {
        console.error('❌ Room name cannot be empty');
        return;
    }

    console.log('🚀 Starting MQTT connection');

    const mqttClient = window.mqtt.connect('ws://localhost:8888');

    mqttClient.on('connect', async () => {
        console.log('🔌 Connected to MQTT broker');

        mqttClient.subscribe(`${room}/#`);

        peer = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        peer.onicecandidate = event => {
            if (event.candidate) {
                console.log('🧊 Sending ICE candidate');
                mqttClient.publish(`${room}/ice`, JSON.stringify({
                    from: peerId,
                    candidate: event.candidate
                }));
            }
        };

        peer.ontrack = event => {
            console.log('📺 Remote video received');
            remoteVideo.srcObject = event.streams[0];
        };

        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('🎥 Local video ready');
            localVideo.srcObject = localStream;
            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            console.log('📤 Sending offer');
            mqttClient.publish(`${room}/offer`, JSON.stringify({
                from: peerId,
                offer
            }));
        } catch (err) {
            console.error('❌ Could not access camera or mic', err);
        }
    });

    mqttClient.on('message', async (topic, payloadBuffer) => {
        const message = JSON.parse(payloadBuffer.toString());
        if (message.from === peerId) return; // Ignore own messages

        console.log(`📥 MQTT message on ${topic}:`, message);

        if (topic.endsWith('/offer')) {
            console.log('📥 Offer received');
            await peer.setRemoteDescription(message.offer);

            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log('🎥 Local video ready (for answer)');
            localVideo.srcObject = localStream;
            localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            console.log('📤 Sending answer');
            mqttClient.publish(`${room}/answer`, JSON.stringify({
                from: peerId,
                answer
            }));
        } else if (topic.endsWith('/answer')) {
            console.log('📥 Answer received');
            await peer.setRemoteDescription(message.answer);
        } else if (topic.endsWith('/ice')) {
            console.log('🧊 ICE candidate received');
            await peer.addIceCandidate(message.candidate);
        }
    });

    mqttClient.on('error', (err) => console.error('⚠️ MQTT Error:', err));
}

function stopConnection() {
    console.log('❌ Stopping connection');

    if(room) {
        room=null;
    }

    if (peer) {
        peer.close();
        peer = null;
    }

    if (mqttClient) {
        mqttClient.end();
        mqttClient = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}
