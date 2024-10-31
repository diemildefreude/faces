
//stream elements
const canvasContainer = document.querySelector('.js-canvas-container');
const croppedCanvas = document.querySelector('.js-crop-canvas');
const vidStream = document.querySelector('.js-video-stream');
const streamElements = [canvasContainer, vidStream];
//page sections------------------
const pageTop = document.querySelector('.js-top');
const pagePermission = document.querySelector('.js-permission');
const pageFaceInput = document.querySelector('.js-face-input');
const pageVoiceInput = document.querySelector('.js-voice-input');
const pageControls = document.querySelector('.js-controls');
const pageWorld = document.querySelector('.js-world');
const pageParts = [pageTop, pagePermission, pageFaceInput, pageVoiceInput,
    pageControls, pageWorld];
//top buttons---------------------
const topBecomeFaceBut = document.querySelector('.js-top-become-a-face-but');
const topViewWorldBut = document.querySelector('.js-top-view-faces-but');
//permission buttons--------------
const permissionBackBut = document.querySelector('.js-permission-back-but');
const permissionAgreeBut = document.querySelector('.js-permission-agree-but');
//photo buttons-------------------
const videoDevSel = document.querySelector('.js-video-dev-sel');
const invalidVidDevText = document.querySelector('.js-invalid-vid-dev-text');
const startingVidDevText = document.querySelector('.js-starting-vid-dev-text');
const analyzingPhotoText = document.querySelector('.js-analyzing-photo-text');
const photoNoFaceError = document.querySelector('.js-photo-no-face-error');
const photoTexts = [invalidVidDevText, startingVidDevText, analyzingPhotoText, photoNoFaceError];
const photoTakeBut = document.querySelector('.js-photo-take-but');
const photoRetakeBut = document.querySelector('.js-photo-retake-but');
const photoBackBut = document.querySelector('.js-photo-back-but');
const photoConfirmBut = document.querySelector('.js-photo-confirm-but');
const photoButs = [photoTakeBut, photoRetakeBut, photoBackBut, 
    photoConfirmBut, photoNoFaceError];
//voice buttons-------------------
const invalidAudDevText = document.querySelector('.js-invalid-aud-dev-text');
const startingAudDevText = document.querySelector('.js-starting-aud-dev-text');
const savingText = document.querySelector('.js-voice-saving-text');
const voiceRecText = document.querySelector('.js-voice-recording-text');
const saveErrorText = document.querySelector('.js-voice-error-text');
const voiceTexts = [invalidAudDevText, startingAudDevText, savingText, voiceRecText, saveErrorText];
const audioDevSel = document.querySelector('.js-audio-dev-sel');
const voiceRecBut = document.querySelector('.js-voice-rec-but');
const voiceBackBut = document.querySelector('.js-voice-back-but');
const voicePlayBut = document.querySelector('.js-voice-play-but');
const voiceStopBut = document.querySelector('.js-voice-stop-but');
const voiceConfirmBut = document.querySelector('.js-voice-confirm-but');
const voiceRerecBut = document.querySelector('.js-voice-rerec-but');
const voiceButs = [voiceRecBut, voiceBackBut, voiceConfirmBut, voiceRerecBut, voicePlayBut, voiceStopBut];
const audioPlayer = document.querySelector('.js-audio-player');
let audioUrl;

//control buttons/texts------------------
const controlViewBut = document.querySelector('.js-ty-view-but');
const controlTopBut = document.querySelector('.js-ty-top-but');
const controlBackBut = document.querySelector('.js-ty-back-but');
const thanksText = document.querySelector('.js-thank-you');
const controlElements = [controlTopBut, controlBackBut, thanksText];

let isPhotoTaken = false;
let isVoiceRecorded = false;
let isVidStreamOn = false;
let isAudStreamOn = false;
let isFirstVoiceRecording = true;
let vidDevCheckPromIdA = 0;
let audDevCheckPromIdA = 0;

let mediaPermissionGranted = false;

import { initFace, startAudioStream, onPhotoTake, onVoiceRec, getMediaPermission,
    startVideoStream, startFft, stopFft, updateDeviceList, stopStream, abortStream, saveData,
     deleteData} from "./mediaRecord.js";
import { initWorld } from "./world.js";
import { modelsLoaded } from "./face-detect.js";

function radioToggle(elements, except=[]) //hides all elements in array except...
{
    if(except == null)
    {
        except = [];
    }
    if (!Array.isArray(except)) 
    {
        except = [except];
    }

    for(let i = 0; i < elements.length; ++i)
    {
        let tog = except.length > 0;
        for(let j = 0; j < except.length; ++j)
        {
            tog = elements[i] == except[j];
            if(tog)
            {  
                break;  
            }
        }
        elements[i].classList.toggle('hidden', !tog);
        if(tog)
        {
            continue;
        }
    }
}

topBecomeFaceBut.addEventListener('click', () => 
{
    location.hash = ""; //to erase the #statement hash that might be present
    history.replaceState("", "", location.pathname);
    radioToggle(pageParts, pagePermission);   
    initFace();
});

topViewWorldBut.addEventListener('click', () =>
{
    location.hash = "";
    history.replaceState("", "", location.pathname);
    radioToggle(pageParts, pageControls);
    radioToggle(controlElements, controlBackBut);
    stopStream();
    abortStream(); //this prevents the stream from starting if a previous promise to start the stream gets resolved after this
});

permissionBackBut.addEventListener('click', () => 
{
    stopStream();
    abortStream();
    radioToggle(pageParts, pageTop);
});

permissionAgreeBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pageFaceInput);
    
    if(isPhotoTaken || isVidStreamOn) //keep previous state of pageFace
    {
        return;
    }
      
    radioToggle(photoButs, photoBackBut);
    radioToggle(photoTexts, startingVidDevText);
    radioToggle(streamElements);

    startCamera();    
});

async function startCamera()
{
    vidDevCheckPromIdA++;
    const vidDevCheckPromIdB = vidDevCheckPromIdA;
    // console.log("devSel->getPerm->startVid", vidDevCheckPromIdB);
    const isFirstTime = !mediaPermissionGranted;
    await stopStream();
    mediaPermissionGranted = await getMediaPermission(mediaPermissionGranted);
    if(mediaPermissionGranted && isFirstTime)
    {
        console.log("updating devices");
        await updateDeviceList();
    }
    else if(!mediaPermissionGranted)
    {
        console.log("permission not granted!");
        invalidVidDevText.classList.toggle("hidden", false);
        return false;
    }

    await stopStream(); 
    const streamOn = await startVideoStream();
    
    //console.log("afterStart, isVidStreamOn:", streamOn, vidDevCheckPromIdB);
    if(vidDevCheckPromIdA != vidDevCheckPromIdB)
    {
        console.log("vidDev load overridden", vidDevCheckPromIdB, vidDevCheckPromIdA);
        return;
    }
    startingVidDevText.classList.toggle("hidden", true);
    isVidStreamOn = streamOn;        

    if(isVidStreamOn)
    {
        vidStream.classList.toggle("hidden", false);
        spawnTakeButton();
    }
    else
    {
        invalidVidDevText.classList.toggle("hidden", false);
    }
}

function spawnTakeButton()
{    
    if(modelsLoaded)
    {
        radioToggle(photoButs, [photoTakeBut, photoBackBut]);
        return;
    }
    setTimeout(spawnTakeButton, 500);
}

videoDevSel.addEventListener('change', (e) =>
{
    radioToggle(photoTexts, startingVidDevText);
    photoTakeBut.classList.toggle("hidden", true);
    vidStream.classList.toggle("hidden", true);    
    startCamera();
});

photoTakeBut.addEventListener('click', (e) =>
{   
    videoDevSel.classList.toggle('hidden', true);
    radioToggle(photoButs);
    isPhotoTaken = false;
    croppedCanvas.classList.toggle('centered', false);
    radioToggle(photoTexts, analyzingPhotoText);
    radioToggle(streamElements);

    onPhotoTake(e).then((photoCropped) => 
    {
        if(photoCropped)
        {
            isPhotoTaken = true;
            radioToggle(photoButs, [photoConfirmBut, photoRetakeBut, photoBackBut]);
            radioToggle(streamElements, canvasContainer);
            radioToggle(photoTexts);
            croppedCanvas.classList.toggle('centered', true);
        }
        else
        {
            radioToggle(photoButs, [photoBackBut, photoTakeBut]);
            radioToggle(photoTexts, photoNoFaceError);
            radioToggle(streamElements, vidStream);
            videoDevSel.classList.toggle('hidden', false);
        }
    });
});

photoRetakeBut.addEventListener('click', () =>
{
    isPhotoTaken = false;
    radioToggle(streamElements, vidStream);
    videoDevSel.classList.toggle('hidden', false);
    
    if(isVidStreamOn)
    {
        radioToggle(photoButs, [photoBackBut, photoTakeBut]);
        return;
    }

    isAudStreamOn = false;
    radioToggle(photoButs, photoBackBut);vidDevCheckPromIdA++;

    const vidDevCheckPromIdB = vidDevCheckPromIdA;

    startVideoStream().then((streamOn) =>
    {
        if(vidDevCheckPromIdA != vidDevCheckPromIdB)
        {
            return;
        }
        if(streamOn)
        {
            isVidStreamOn = true;
            radioToggle(photoButs, [photoBackBut, photoTakeBut])
        }
    });
});

photoBackBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pagePermission);
});

photoConfirmBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pageVoiceInput);
    if(isVoiceRecorded) //keep previous state of pageVoice
    {
        return;
    }
    radioToggle(voiceButs, voiceBackBut);
    radioToggle(voiceTexts, startingAudDevText);
    isVidStreamOn = false;
    startMic();    
});

audioDevSel.addEventListener('change', () =>
{
    radioToggle(voiceTexts, startingAudDevText);    
    const recBut = isFirstVoiceRecording ? voiceRecBut : voiceRerecBut;
    recBut.classList.toggle("hidden", true);
    startMic();    
});

async function startMic()
{
    audDevCheckPromIdA++;
    const audDevCheckPromIdB = audDevCheckPromIdA;
    await stopStream();
    const streamOn = await startAudioStream();
    console.log("afterStart, isAudStreamOn:", streamOn, audDevCheckPromIdB);
    if(audDevCheckPromIdA != audDevCheckPromIdB)
    {
        console.log("audDev load overridden", audDevCheckPromIdB, audDevCheckPromIdA);
        return;
    }
    startingAudDevText.classList.toggle("hidden", true);
    isAudStreamOn = streamOn;
    if(isAudStreamOn)
    {
        isAudStreamOn = true;
        voiceRecBut.classList.toggle('hidden', false);
        radioToggle(voiceTexts);
        startFft();
    }
    else
    {
        radioToggle(voiceTexts, invalidAudDevText); 
    }
}

function recordAudio()
{
    radioToggle(voiceButs);
    radioToggle(voiceTexts, voiceRecText);
    isVoiceRecorded = false;    
    audioDevSel.classList.toggle('hidden', true);
    audioPlayer.classList.toggle('hidden', true);
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    onVoiceRec().then((validRecording) =>
    {
        if(validRecording)
        {
            audioUrl = validRecording;
            isVoiceRecorded = true;
            audioDevSel.classList.toggle('hidden', false);
            radioToggle(voiceButs, [voiceRerecBut, voiceBackBut, voicePlayBut, voiceConfirmBut]);
            radioToggle(voiceTexts);
        }
        else
        {
            audioDevSel.classList.toggle('hidden', false);
            radioToggle(voiceTexts, invalidAudDevText);
            radioToggle(voiceButs, [voiceRerecBut, voiceBackBut]);
        }
        isFirstVoiceRecording = false;
    });
}

voiceRecBut.addEventListener('click', () =>
{
    recordAudio();
});

voiceRerecBut.addEventListener('click', (e) =>
{
    radioToggle(voiceTexts);
    if(isVidStreamOn || !isAudStreamOn)
    {
        isVidStreamOn = false;
        isAudStreamOn = true;
        startAudioStream().then(recordAudio);
        return;
    }
    recordAudio();    
});

voicePlayBut.addEventListener('click', (e) =>
{
    audioPlayer.src = audioUrl;
    audioPlayer.play();
    voicePlayBut.classList.toggle('hidden', true);
    voiceStopBut.classList.toggle('hidden', false);
});

voiceStopBut.addEventListener('click', (e) =>
{
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    voicePlayBut.classList.toggle('hidden', false);
    voiceStopBut.classList.toggle('hidden', true);
});

audioPlayer.addEventListener('ended', (e) =>
{
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    voicePlayBut.classList.toggle('hidden', false);
    voiceStopBut.classList.toggle('hidden', true);
});

voiceBackBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pageFaceInput);
});

//maybe add "loading/sending" graphics later on
voiceConfirmBut.addEventListener('click', () =>
{   
    radioToggle(voiceTexts, savingText);
    radioToggle(voiceButs);      
    audioDevSel.classList.toggle('hidden', true);
    stopFft();
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    saveData().then((success) => 
    {
        radioToggle(pageParts, pageControls);
        radioToggle(controlElements, [thanksText, controlTopBut])  
        radioToggle(photoButs, photoBackBut);
        radioToggle(voiceButs, voiceBackBut);
        isVoiceRecorded = false;
        isPhotoTaken = false;
        deleteData();
        stopStream();
        abortStream();
    })
    .catch((error) => 
    {
        console.log(error);
        radioToggle(voiceTexts, saveErrorText);
        radioToggle(voiceButs, [voiceBackBut, voicePlayBut, voiceConfirmBut, voiceRerecBut]);
        audioDevSel.classList.toggle('hidden', false);
        startFft();
    });
});

controlTopBut.addEventListener('click', () => 
{
    radioToggle(pageParts, pageTop);
});
controlBackBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pageTop);
});
controlViewBut.addEventListener('click', () =>
{
    radioToggle(pageParts, pageWorld);
    initWorld();
});
