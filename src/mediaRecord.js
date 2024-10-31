// add audio input/output selector too: https://github.com/webrtc/samples/blob/gh-pages/src/content/devices/input-output/js/main.js

// https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Taking_still_photos

//(() =>
//{
const photoMaxH = 500;
let photoW = 0;
let photoH = 0;
const videoSelect = document.querySelector('select#video-source');
const videoElement = document.querySelector('.js-video-stream');
//const canvasContainer = document.querySelector('.canvas-container');
const mediaCanvas = document.querySelector('#media-canvas');
let croppedCanvas;
const audioSelect = document.querySelector('select#audio-source');
let fftCanvas, fftCanvasCtx, fftArray, fftBufferLength, fftAnalyzer;
const fftWidth = 500;
const fftHeight = 100;
//const selectors = [videoSelect, audioSelect ];
//const audioContext = new AudioContext;
let voiceRecTimeout;
let audioRecorder;
let fftAnimationId, fftSource;
export let isStreamOn = true;
export let blobUrl, voiceChunks = [], blob;
import { initializeFaceApi, runDetection } from "./face-detect.js";

document.addEventListener('DOMContentLoaded', () =>
{
    navigator.mediaDevices.getUserMedia = navigator.mediaDevices.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;
});

export async function updateDeviceList() 
{
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoSelect.innerHTML = '';
    
    devices.forEach(device => 
    {
        if (device.kind === 'videoinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `camera ${videoSelect.length + 1}`;
            videoSelect.appendChild(option);
            //console.log('vidDev ' + videoSelect.length + ' found', option.value, option.text);
        }
        else if (device.kind === 'audioinput') {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `mic ${audioSelect.length + 1}`;
            audioSelect.appendChild(option);
            //console.log('audDev ' + audioSelect.length + ' found', option.value, option.text);
        }
    });
}

function gotVideoStream(stream)
{    
    window.stream = stream;

    if(!isStreamOn) //can be false if abortStream() called
    {
        stopStream();
        console.log('abort stream');
        return;//navigator.mediaDevices.enumerateDevices();
    }

    if("srcObject" in videoElement)
    {
        videoElement.srcObject = stream;
    }
    else //old version...
    {
        videoElement.src = window.URL.createObjectURL(stream);
    }

    videoElement.onloadedmetadata = function()
    {
        videoElement.play();
        videoElement.muted = true;
    }  

    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const isMirroredCam = settings.facingMode === 'user' || videoTrack.label.toLowerCase().includes('front') || 
    videoTrack.label.toLowerCase().includes('integrated') ;
    console.log("isMirrored", isMirroredCam);
    videoElement.classList.toggle('mirrored', isMirroredCam);
}

export function abortStream()
{
    isStreamOn = false;
}

function gotAudioStream(stream)
{
    window.stream = stream;
    audioRecorder = new MediaRecorder(stream);
    //return navigator.mediaDevices.enumerateDevices();
}

async function normalizeAudio(b)
{    
    return new Promise (async (resolve) => 
    {            
        // Analyze the audio data
        const arrayBuffer = await b.arrayBuffer();
        const normalizeCtx = new AudioContext();
        const audioBuffer = await normalizeCtx.decodeAudioData(arrayBuffer);
        const gainNode = normalizeCtx.createGain();

        // Find the peak level
        let max = 0;
        for (let i = 0; i < audioBuffer.length; i++) 
        {
            if (audioBuffer.getChannelData(0)[i] > max) 
            {
                max = audioBuffer.getChannelData(0)[i];
            }
        }

        // Normalize the audio
        let normalizationFactor = max != 0 ? 1 / max : 1;
        console.log("normalization factor", normalizationFactor)
        gainNode.gain.value = Math.min(4.0, normalizationFactor);

        // Create a mute gain node
        const muteGainNode = normalizeCtx.createGain();
        muteGainNode.gain.value = 0; // Mute the audio

        // Connect the nodes and create a new Blob
        const source = normalizeCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(muteGainNode);
        muteGainNode.connect(normalizeCtx.destination);

        // Convert the processed audio back to a Blob
        const destination = normalizeCtx.createMediaStreamDestination();
        gainNode.connect(destination);
        const normalizedStream = destination.stream;
        const mediaRecorder = new MediaRecorder(normalizedStream);

        let normChunks = [];
        mediaRecorder.ondataavailable = (event) => 
        {
            normChunks.push(event.data);
        };    
        mediaRecorder.onstop = () =>
        {            
            const normalizedBlob = new Blob(normChunks, { type: "audio/mp3" });
            resolve(normalizedBlob);
        };
        mediaRecorder.start();
        source.start(0);
        source.onended = () =>
        {
            mediaRecorder.stop();
        };
    });
}

export async function saveData()
{
    let formData = new FormData();
    formData.append("action", "save_data");

    const normalizedBlob = await normalizeAudio(blob);
    formData.append("audio_data", normalizedBlob, "filename.mp3");

    const imgUrl = croppedCanvas.toDataURL("image/webp"); 
    const imgBlob = dataURLtoBlob(imgUrl);    
    formData.append("image_data", imgBlob, "filename.webp");

    return new Promise((resolve, reject) =>
    {
        //fetch("http://localhost:80/website/faces/public/database.php",
        fetch("./database.php",
        {
            method: "POST",
            body: formData
        })
        .then(response => response.text())
        .then(success => resolve(success))
        .catch(error => reject(error));   
    });
}

function dataURLtoBlob(dataURL)
{
    const arr = dataURL.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--)
    {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function handleErr(err)
{
    console.log(err.name, err.message);
}

export async function getMediaPermission(isAlreadyGranted)
{
    if(isAlreadyGranted)
    {
        //console.log("permis, already granted");
        return true;
    }
    let stream;
    try 
    {
        stream = await navigator.mediaDevices.getUserMedia(
        {
            video: { width: 1, height: 1 }, 
            audio: true
        });   
    } 
    catch (error) 
    {
        console.error('Permission denied or error:', error);
        return false;
    }
    console.log("got permission");
    window.stream = stream;
    return true;
}

export async function startVideoStream()
{     
    isStreamOn = true;

    const videoSource = videoSelect.value;
    //console.log("startVideoStream, videoSelect.value", videoSelect.value);
    const constraints = 
    {
        video: 
        { 
            deviceId: videoSource ? {exact: videoSource} : undefined,
            width: {min: 640, ideal: 1920, max: 1920}, //OR width: 1280, height 720
            height: {min: 480, ideal: 1080, max: 1920}
        }
    };
    let stream;
    try 
    {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        gotVideoStream(stream);
        return true;
    } 
    catch (error) 
    {
        console.error('Error starting video stream:', error);
        return false;
    }
}
export async function startAudioStream()
{
    isStreamOn = true;
    
    const audioSource = audioSelect.value;
    const constraints =
    {
        audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    }
    let stream;
    try
    {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        gotAudioStream(stream);
        return true;
    }     
    catch(error)
    {
        console.error('Error starting audio stream:', error);
        return false;
    } 
}

export function startFft()
{
    const audioCtx = new AudioContext();
    fftAnalyzer = audioCtx.createAnalyser();
    fftSource = audioCtx.createMediaStreamSource(window.stream);
    fftSource.connect(fftAnalyzer);
    fftAnalyzer.fftSize = 2048;
    fftBufferLength = fftAnalyzer.frequencyBinCount;
    fftArray = new Uint8Array(fftBufferLength);
    fftCanvas = document.querySelector('#fft-canvas');
    fftCanvas.width = fftWidth;
    fftCanvas.height = fftHeight;
    fftCanvasCtx = fftCanvas.getContext('2d'); //needs args?
    fftCanvasCtx.clearRect(0,0, fftCanvas.width, fftCanvas.height);
    drawFft();
}

function drawFft()
{
    fftAnimationId = requestAnimationFrame(drawFft);
    fftAnalyzer.getByteTimeDomainData(fftArray);
    fftCanvasCtx.fillStyle = "rgb(80, 142, 197)";
    fftCanvasCtx.fillRect(0, 0, fftCanvas.width, fftCanvas.height);
    fftCanvasCtx.lineWidth = 2;
    fftCanvasCtx.strokeStyle = "rgb(113, 169, 113)";
    fftCanvasCtx.beginPath();
    const sliceWidth = fftCanvas.width / fftBufferLength;
    let x = 0;
    for (let i = 0; i < fftBufferLength; i++) 
    {
        const v = fftArray[i] / 128.0;
        const y = v * (fftCanvas.height / 2);
      
        if (i === 0) {
          fftCanvasCtx.moveTo(x, y);
        } else {
          fftCanvasCtx.lineTo(x, y);
        }
      
        x += sliceWidth;
    }
    fftCanvasCtx.lineTo(fftCanvas.width, fftCanvas.height / 2);
    fftCanvasCtx.stroke();
}

export function stopFft() 
{
    cancelAnimationFrame(fftAnimationId);
    fftAnalyzer.disconnect();
    fftSource.disconnect();
    fftCanvasCtx.clearRect(0, 0, fftCanvas.width, fftCanvas.height);
    fftAnalyzer = null;
    fftSource = null;
    fftAnimationId = null;
}

export async function stopStream()
{
    if(window.stream)
    {
        window.stream.getTracks().forEach(track =>
        {
            track.stop();
        });
        window.stream = null;
        await new Promise(resolve => setTimeout(resolve, 500));
        //console.log("stream stopped");
        return;
    }
    //console.log("there was no stream to stop");
}

function clearPhoto()
{
    const context = mediaCanvas.getContext("2d");
    context.fillStyle = "#AAA";
    context.fillRect(0, 0, mediaCanvas.width, mediaCanvas.height);
}

function takePhoto()
{
    const context = mediaCanvas.getContext("2d");
    if(videoElement.videoHeight && videoElement.videoWidth)
    {
        mediaCanvas.classList.remove("hidden");
        mediaCanvas.width = videoElement.videoWidth;
        mediaCanvas.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, videoElement.videoWidth, videoElement.videoHeight);

        const data = mediaCanvas.toDataURL("image/webp");
        //imgElement.setAttribute("src", data);
        return data;
    }
    else
    {
        console.log("couldn't take");
        clearPhoto();
    }
}

//videoSelect.onchange = startVideoStream;
//audioSelect.onchange = startAudioStream;

export const initFace = () =>
{    
    initializeFaceApi();
    //let voiceChunks = [];
    
    //photoButton.addEventListener()
}

//export const initVoice = () => startAudioStream;

export const onVoiceRec = async () =>
{
    if(!window.stream)
    {
        return false;
    }
    return new Promise((resolve) =>
    {    
        voiceChunks = [];
        let blobUrl;
        audioRecorder.onstop = async () =>
        {
            blob = new Blob(voiceChunks, { type: "audio/mp3" });
            blobUrl = URL.createObjectURL(blob);
            
            // if(e.data.size == 0)
            // {
            //     resolve(false);
            // }
            // else
            //{
                resolve(blobUrl);
            //}
            //document.querySelector("audio").src = blobUrl;
        }
        audioRecorder.ondataavailable = (e) => 
        {
            voiceChunks.push(e.data);
        };
        audioRecorder.start();
        if(voiceRecTimeout)
        {
            clearTimeout(voiceRecTimeout);
        }
    
        voiceRecTimeout = setTimeout(() => 
        {
            audioRecorder.stop();
            
        }, 7000);
    })    
};

// export const endRecording = () =>
// {
//     if(voiceRecTimeout)
//     {
//         clearTimeout(voiceRecTimeout);
//     }
//     audioRecorder.stop();
// };

export const onPhotoTake = async (e) =>
{
    if(!window.stream)
    {
        return false;
    }
    const data = takePhoto();
    e.preventDefault();
    croppedCanvas = await runDetection(data, mediaCanvas);
    if(!croppedCanvas)
    {
        return croppedCanvas;
    }

    photoH = Math.min(photoMaxH, croppedCanvas.height);
    photoW = photoH * (croppedCanvas.width / croppedCanvas.height);
    
    const cc = croppedCanvas.getContext('2d');
    const idat = cc.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);

    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = croppedCanvas.width;
    resizeCanvas.height = croppedCanvas.height;
    const resizeCtx = resizeCanvas.getContext('2d');
    resizeCtx.putImageData(idat, 0, 0);

    // Resize the croppedCanvas
    croppedCanvas.width = photoW;
    croppedCanvas.height = photoH;
    croppedCanvas.style.top = 0 + 'px';
    croppedCanvas.style.left = 0 + 'px';

    // Redraw the saved content
    cc.drawImage(resizeCanvas, 0, 0, resizeCanvas.width, resizeCanvas.height, 0, 0, photoW, photoH);
    resizeCanvas.remove();
    //videoElement.setAttribute("width", photoW);
    //videoElement.setAttribute("height", photoH);
    //canvasContainer.style.width = `${photoW}px`;
    //canvasContainer.style.height = `${photoH}px`;

    //saveCanvas(canv);
    return croppedCanvas;
}

export function deleteData()
{
    croppedCanvas.getContext("2d").clearRect(0,0,0,0);
    blob = null;
}

