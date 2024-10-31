//console.log(faceapi)
//import * as faceapi from './face-api.min.js';
const faceapi = window.faceapi;
const borderBuffer = 0.5; //* width
export let modelsLoaded = false;
let detectionTimeout;
//const borderBufferTop = 0.5; //* height


export const initializeFaceApi = async() =>
{
    //console.log(faceapi.nets.ssdMobilenetv1);
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('./faceModels'), //facial detection 
        faceapi.nets.faceLandmark68Net.loadFromUri('./faceModels'), 
        faceapi.nets.faceRecognitionNet.loadFromUri('./faceModels'),
        faceapi.nets.ageGenderNet.loadFromUri('./faceModels'),
    ]);
    modelsLoaded = true;
};

export const runDetection = async(data, mediaCanvas)=>
{
    clearTimeout(detectionTimeout);
    if(!modelsLoaded)
    {
        detectionTimeout = setTimeout(runDetection, 0.5);
        return;
    }  
    const detectImage = await faceapi.fetchImage(data);
    let faceAIData = await faceapi.detectAllFaces(detectImage/*, new faceapi.TinyFaceDetectorOptions()*/)
        .withFaceLandmarks()
        .withFaceDescriptors()
        .withAgeAndGender();
    if(faceAIData.length == 0)
    {
        return false;
    }
    const faceRect = faceAIData[0].detection.box;

    //faceAIData = faceapi.resizeResults(faceAIData, detectImage);
    const detectCanvas = document.getElementById('detect-canvas');    
    const cropCanvas = document.getElementById('crop-canvas');
    
    detectCanvas.style.left = detectImage.offsetLeft;
    detectCanvas.style.top = detectImage.offsetTop;
    detectCanvas.width = detectImage.width;
    detectCanvas.height = detectImage.height;

    const cropContext = cropCanvas.getContext("2d");

    //example values in comments. In this scenario, the detectImage's left offset is 15, not 0:
    let cropCanvasX = faceRect.x - faceRect.width * borderBuffer; //5
    let cropCanvasY = faceRect.y - faceRect.height * borderBuffer;
    let cropCanvasW = faceRect.width + faceRect.width * borderBuffer * 2; //40   
    let cropCanvasH = faceRect.height + faceRect.height * borderBuffer * 2;

    const leftAdjust = Math.max(detectImage.offsetLeft - cropCanvasX, 0); // Math.max(15 - 5) = 10
    const cropCanvasR = cropCanvasX + cropCanvasW; // 5 + 40 = 45
    const detectR = detectImage.offsetLeft + detectImage.width; // 15 + 200 = 215
    const rightAdjust = Math.max(cropCanvasR - detectR, 0); // Math.max(45 - 215, 0) = 0
    cropCanvasX = cropCanvasX + leftAdjust; // 5 + 10 = 15
    cropCanvasW = cropCanvasW - leftAdjust - rightAdjust;

    const topAdjust = Math.max(detectImage.offsetTop - cropCanvasY, 0);
    const cropCanvasB = cropCanvasY + cropCanvasH;
    const detectB = detectImage.offsetTop + detectImage.height;
    const bottomAdjust = Math.max(cropCanvasB - detectB, 0);
    cropCanvasY = cropCanvasY + topAdjust;
    cropCanvasH = cropCanvasH - topAdjust - bottomAdjust;

    const cropOffsetX = detectImage.offsetLeft - cropCanvasX;
    const cropOffsetY = detectImage.offsetTop - cropCanvasY;

    cropCanvas.style.left = `${cropCanvasX}px`;
    cropCanvas.style.top = `${cropCanvasY}px`;
    cropCanvas.width = cropCanvasW;
    cropCanvas.height = cropCanvasH;
    cropContext.drawImage(mediaCanvas, cropOffsetX, cropOffsetY, 
        detectImage.width, detectImage.height);
    
    mediaCanvas.classList.add("hidden");
    return cropCanvas;
}