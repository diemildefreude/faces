import * as Three from 'three';//'../node_modules/three/build/three.module.min.js';
import CameraControls from 'camera-controls';//'../node_modules/camera-controls/dist/camera-controls.module.min.js';
CameraControls.install( {THREE: Three });

import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'; //'../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';//'../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';//'../node_modules/three/examples/jsm/postprocessing/ShaderPass.js';

let scene, camera, renderer, /*gridHelper, controls,*/ animateId, canvas, composer;
let cameraControls;
const azimuthSpeed = 0.2;
const polarSpeed = 0.2;
let scrollDir = -0.1;
const moveForwardMult = 1.0; //for desktop "wheel"
const movePinchMult = 4; //for mobile
//const rotateMobileMult = 2;
//const dollySpeed = 0.1;
const moveSpeedMin = 0.45;//0.1;
const moveSpeedMax = 0.45;//0.3;
let isAnimating = false;
let facesData; 
let facesAvailableData;
const activeFaces = [];
const inactiveFaces = [];
const facesWithAudio = [];
let texLoad;
let frag, vert;
const shadersDir = './shaders';
const worldColor = 0x000000;//0x666666;//0x181111;
const faceScale = 1.0;
const maxSpawnDistForward = 8.5;
const maxSpawnDistBack = 6.0; //these are not magnitude, but values for...
const minSpawnDistForward = 5.0;
const minSpawnDistBack = 2.0;
//const minSpawnDist = 2.0; //...individual axes
let lastUpdate;
let audioListener, audioLoader;
const audioVol = 0.7;
const audioRefDist = 0.7;
const minAudioWait =  10000; //ms
const maxAudioWait = 120000; //ms
const faceMaxDist = 8.5; //vector magnitude
const faceMinDist = 1.0; //""
const minNearFaces = 280;
const maxFaces = 300;
const maxAudios = 8;
let isNewSpawnOn = false;
const furthestVolFadeDur = 1000;
const volFadeSpeed = 1.0 / furthestVolFadeDur;
const pollingIntervalDur = 30000;
const resizeCheckIntervalDur = 3000;
let currentWinRes;
const idleTimerDur = 30000; 
let idleTimer = 0;
let isIdle = false;
let isPointerDown = false;
//--
const spawnTimerMinDur = 100;
const spawnTimerMaxDur = 3500;
let spawnTimerDur = 250;
let spawnTimer = 0;
let autoMoveQueue = [];

let raycaster, click;


class FaceData
{
    constructor(id, imageUrl, audioUrl)
    {
        this.id = id;
        this.imageUrl = imageUrl;
        this.audioUrl = audioUrl;
    }
}

class Face
{
    #alpha = 0.0;
    #volFade = 1.0; //for fading out before reassignment of this.sound to another Face()
    #isVolFading = false;
    #isFading = false;
    #fadeDir = 1; //-1 for down
    #volFadeDir = 1;
    #fadeSpeed = 0.0003;
    #startPos;
    #isAudioLoading = false;
    soundTimeout = null;
    #inOutFade = 0.0; //for start and end of a file
    #isInOutFading = false;
    #inOutFadeDir = 1;
    #inOutFadeOutThreshold = 0.0;
    #inOutFadeSpeed = 0.0;
    #playStartTime = 0;
    #bufferDur = 0; //ms
    #inOutFadeDur = 1000; //ms
    #fade(delta)
    {
        this.#alpha += delta * this.#fadeDir * this.#fadeSpeed;
        this.#alpha = Math.min(Math.max(this.#alpha, 0.0), 1.0);
    };
    #updateShader(strength)
    {
        this.uniforms.u_alpha.value = this.#alpha;

        const blur = strength * 30.0 + 3.0;
        this.uniforms.u_blurStrength.value = blur;
    }
    #updateSound(strength, delta)
    {
        if(this.#isVolFading)
        {
            this.#volFade += delta * volFadeSpeed * this.#volFadeDir;
            this.#volFade = Math.min(1.0, Math.max(this.#volFade, 0.0));

            if((this.#volFade <= 0.0 && this.#volFadeDir == -1)
            || (this.#volFade >= 1.0 && this.#volFadeDir == 1))
            {
                this.#isVolFading = false;
            }
        }

        if(this.#isInOutFading)
        {
            this.#inOutFade += delta * this.#inOutFadeSpeed * this.#inOutFadeDir;
            this.#inOutFade = Math.min(1.0, Math.max(this.#inOutFade, 0.0));

            const currentPlayTime = Date.now() - this.#playStartTime;
            if(this.#inOutFadeDir == 1 && currentPlayTime > this.#inOutFadeOutThreshold)
            {
                this.#inOutFadeDir = -1;
            }
        }

        if(!this.sound || !this.sound.source)
        {
            return;
        }

        const v = this.#alpha * this.#volFade * this.#inOutFade;
        if(v > 1.0)
        {
            console.log("TOO LOUD", v);
        }
        this.sound.setVolume(Math.pow(v, 2));

        const lopFreq = Math.pow(1.0 - strength,3) * 9950 + 100.0;
        this.filter.frequency.setValueAtTime(lopFreq, 
            this.sound.source.context.currentTime);
    }
    #handleFading(delta)
    {
        if(this.#isFading)
        {
            if(this.#fadeDir == 1 && this.#alpha >= 1.0)
            {
                this.#isFading = false;
                return;
            }
            if(this.#fadeDir == -1 && this.#alpha <= 0.0)
            {
                this.#isFading = false;
                this.#despawn();
                return;
            }
            this.#fade(delta);
            return;
        }
        if(!this.isInRange())
        {
            this.#isFading = true;
            this.#fadeDir = -1.0;
        }
    }
    #despawn()
    {
        this.isActive = false;
        if(this.sound)
        {
            this.sound.stop();
        }
        const i = activeFaces.indexOf(this);
        activeFaces.splice(i, 1);
        inactiveFaces.push(this);       
        scene.remove(this.mesh);
    }
    #rotateMesh(camera, delta)
    {   
        const step = 0.1 * delta;
        this.mesh.quaternion.rotateTowards(camera.quaternion, step);                
    }
    setAudioBuffer(buffer)
    {
        this.audioBuffer = buffer;
        this.sound.setBuffer(buffer);
        this.#bufferDur = buffer.duration * 1000;
        this.#inOutFadeDur = Math.min(this.#bufferDur * 0.5, this.#inOutFadeDur);
        this.#inOutFadeOutThreshold = this.#bufferDur - this.#inOutFadeDur;
        this.#inOutFadeSpeed = 1.0 / this.#inOutFadeDur;
    }
    playSound()
    {
        if(!this.sound || this.sound.isPlaying)
        {
            return;
        }  
        const delRange = maxAudioWait - minAudioWait;
        const delay = delRange * Math.pow(Math.random(),2) + minAudioWait;
        this.soundTimeout = setTimeout(() =>
        {          
            if(!this.sound)
            {
                return;
            }
            
            this.sound.stop(); 
            this.sound.play();
            this.sound.source.onended = () => 
            {
                onSoundEnd(this);
            };
            this.#isInOutFading = true;
            this.#inOutFade = 0.0;
            this.#inOutFadeDir = 1;
            this.#playStartTime = Date.now();
        }, delay);
    }
    stopSound()
    {
        if(!this.sound)
        {
            return;
        }
        this.sound.stop();
        this.#isInOutFading = false;
    }
    startVolFade(dir)
    {
        this.#volFadeDir = dir;
        this.#isVolFading = true;
    }
    getVolFade()
    {
        return this.#volFade;
    }
    update(camera, delta)
    {
        if(!this.isActive || !this.mesh)
        {
            return;
        }
        this.#handleFading(delta); 
        this.#rotateMesh(camera, delta);         

        const time = performance.now() * 0.001 * this.blurTimeMult;
        const strength = (Math.sin(time) + 1.0) * 0.5;

        this.#updateShader(strength);
        this.#updateSound(strength, delta);   
    };        
    startSpawn(scene, pos)
    {
        this.#startPos = pos;
        this.mesh.position.copy(pos);
        this.#volFade = 1.0;
        this.uniforms.u_isTextureGrad.value = Math.random() > 0.66;                 
        this.isActive = true;
        this.#isFading = true;
        this.#alpha = 0.0;
        this.#fadeDir = 1.0;        
        this.mesh.quaternion.rotateTowards(camera.quaternion, 0);   
        scene.add(this.mesh);
    }        
    getAlpha()
    {
        return this.#alpha;
    }
    isInRange()
    {   
        const dist = this.getDistanceToCamera();
        const isInRange = dist <= faceMaxDist && dist > faceMinDist;
        return isInRange;
    }
    getDistanceToCamera()
    {//#startPos is used while mesh is still loading
        const pos = this.mesh ? this.mesh.position : this.#startPos;
        const dist = pos.distanceTo(camera.position);
        return dist;
    }
    getIsVolFading()
    {
        return this.#isVolFading;
    }
    setIsAudioLoading(b)
    {
        this.#isAudioLoading = b;
    }
    getIsAudioLoading()
    {
        return this.#isAudioLoading;
    }
    getIsFading()
    {
        return this.#isFading;
    }
    constructor(data, startPos)
    {
        this.mesh = null;
        this.material = null;
        this.uniforms = null;
        this.texAspect = null;
        this.blurTimeMult = Math.random() * 0.5 + 0.5;
        this.sound = null;
        this.filter = null;
        this.isActive = true;
        this.data = data;     
        this.#startPos = startPos;  
        this.audioBuffer = null;
    }
}

function stopAutoMove()
{
    //cameraControls.stop(); //this is buggy

    if(autoMoveQueue.length == 0)
    {
        return;
    }
    for(let i = 0; i < autoMoveQueue.length; ++i)
    {
        clearTimeout(autoMoveQueue[i]);
    }
    autoMoveQueue = [];
}

function onClick(event)
{
    //console.log("click", event.clientX, event.clientY);
    //console.log(canvas.innerWidth, canvas.innerHeight);
    // Calculate mouse position in normalized device coordinates  

    click.x = (event.clientX / window.innerWidth) * 2 - 1;
    click.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster with the camera and click position
    raycaster.setFromCamera(click, camera);

    // Calculate objects intersecting the ray
    const intersects = raycaster.intersectObjects(scene.children);

    if (intersects.length > 0) 
    {  
        stopAutoMove();
        const intMesh = intersects[0].object;
        const face = activeFaces.find(af => af.mesh === intMesh);
        console.log('Mesh touched:', face.data.imageUrl);
        // You can add your custom logic here
    }
}

function addCanvasListeners()
{
    
    canvas.addEventListener('click', onClick, false); //false?

    canvas.addEventListener("pointermove", (e) =>
    {
        if(isPointerDown)
        {
            isIdle = false;
            idleTimer = 0;
            stopAutoMove();
        }
    });
    canvas.addEventListener("pointerdown", () => isPointerDown = true);
    window.addEventListener("pointerup", () => isPointerDown = false);
    canvas.addEventListener("wheel", (e) => //desktop only
    {
        isIdle = false;
        idleTimer = 0;
        stopAutoMove();
        //cameraControls.update(0);
        const dir = Math.sign(e.deltaY);
        
        if(dir != scrollDir && Math.abs(dir) == 1)
        {        
            const mult = moveForwardMult;//dir == -1 ? moveForwardMult : 1;
            //console.log("desktop: move speed set for scroll wheel", dir);
            //console.log("dir", dir, mult);
            
            cameraControls.dollySpeed = mult;
            scrollDir = dir;
        }
    });
    canvas.addEventListener("touchstart", (e) =>//mobile only
    {
        if(e.touches.length < 2 || cameraControls.minDistance == moveSpeedMin * movePinchMult)
        {
            return;
        }
        cameraControls.minDistance = moveSpeedMin * movePinchMult;
        cameraControls.maxDistance = moveSpeedMax * movePinchMult;
    });
    canvas.addEventListener("mousedown", (e) =>
    {        
        if(cameraControls.minDistance == moveSpeedMin)
        {
            return;
        }
        cameraControls.minDistance = moveSpeedMin;
        cameraControls.maxDistance = moveSpeedMax;
    });
}

function addPhotoBatchToDB()
{
    let formData = new FormData();
    formData.append("action", "add_batch");

    fetch("./database.php",
    //fetch("http://localhost:80/website/faces/public/database.php", //for dev mode (npm run dev)
    {
        method: "POST",
        body: formData
    }).then(response => response.json())
    .then(data => console.log(data));
}

export async function initWorld()
{   
    //addPhotoBatchToDB(); 

    scene = new Three.Scene();    
    texLoad = new Three.TextureLoader();
    setInterval(checkForResize, resizeCheckIntervalDur);

    canvas = document.querySelector('#world');
    raycaster = new Three.Raycaster();
    click = new Three.Vector2();
    addCanvasListeners();

    renderer = new Three.WebGLRenderer({ 
        canvas: canvas,
        depth: false,
        autoClear: false
    });
    const winW = window.innerWidth;
    const winH = window.innerHeight;     
    currentWinRes = {'width': winW, 'height': winH};
    camera = new Three.PerspectiveCamera(75, winW / winH, 0.1, 1000);
    camera.position.set(0, 0, -1);   

    renderer.setClearColor(worldColor, 1);
    renderer.setSize(winW, winH);
    renderer.setPixelRatio(window.devicePixelRatio);

    await setUpPostProcessing(renderer, scene, camera);

    //gridHelper = new Three.GridHelper(200, 50);
    //scene.add(gridHelper);

    cameraControls = new CameraControls(camera, renderer.domElement);
    cameraControls.infinityDolly = true;
    cameraControls.dollyToCursor = true;
    cameraControls.minDistance = moveSpeedMin;
	cameraControls.maxDistance = moveSpeedMax;
    cameraControls.azimuthRotateSpeed = azimuthSpeed;
    cameraControls.polarRotateSpeed = polarSpeed;
    //cameraControls.enableDamping = true;

    audioListener = new Three.AudioListener();
    audioLoader = new Three.AudioLoader();
    camera.add(audioListener);

    const vertFile = await fetch(shadersDir + '/face.vert');
    const fragFile = await fetch(shadersDir + '/face.frag');
    vert = await vertFile.text();
    frag = await fragFile.text();
    
    getFacesData(true).then((data) => 
    {
        isAnimating = true;
        lastUpdate = Date.now();
        animate(); //idleTimer becomes NaN after this... 

        const euler = new Three.Euler();
        euler.setFromQuaternion(camera.quaternion, "XYZ")

        cameraControls.getTarget();
        cameraControls.update(0);

        euler.setFromQuaternion(camera.quaternion, "XYZ")

        facesData = data;
        facesAvailableData = data.slice();
        isNewSpawnOn = true;   
        setTimeout(checkForDBChange, pollingIntervalDur);
    });
}

function animate()
{    
    animateId = requestAnimationFrame( animate );
    
    const delta = getDelta();
    updateCameraControls(delta);
    rendererRender();
    
    const facesInRange = updateFaces(delta);

    manageDistanceSpawns(facesInRange, delta);
    addSoundsToCloserObjects();

    checkIfIdle(delta);
}

function checkIfIdle(delta)
{
    if(!isIdle)
    {
        idleTimer += delta;
    }
    if(idleTimer > idleTimerDur)
    {
        isIdle = true;
        idleTimer = 0;
        autoMove();
    }
}

function checkForResize()
{
    const winW = window.innerWidth;
    const winH = window.innerHeight;  
    if(winW != currentWinRes.width || winH != currentWinRes.height)
    {
        camera.aspect = winW / winH;
        renderer.setSize(winW, winH);
        renderer.setPixelRatio(window.devicePixelRatio);
        currentWinRes.width = winW;
        currentWinRes.height = winH;
        camera.updateProjectionMatrix();
        return;
    }
}

function addSoundsToCloserObjects()
{

    const activeFacesWithAudioUrl = activeFaces.filter(af => af.data.audioUrl != null && af.data.audioUrl != "" 
        && !af.getIsVolFading() && !af.getIsAudioLoading());
    if(activeFacesWithAudioUrl.length == 0)
    {
        return;
    }
    const facesWithDistance = activeFacesWithAudioUrl.map((face) =>
    ({  
        face, 
        distance: face.getDistanceToCamera()  
    }));
    const activeFacesNearestToFarthest = facesWithDistance.sort((a,b) => a.distance - b.distance);//still has distance field
 
    const inactiveFacesWithAudio = facesWithAudio.filter(fwa => !fwa.isActive && !fwa.getIsAudioLoading());

    for(let i = 0; i < activeFacesNearestToFarthest.length; ++i)
    {
        const nearFace = activeFacesNearestToFarthest[i].face;
        if(!nearFace.mesh)
        {
            continue;
        }
        if(nearFace.sound != null)
        {
            if(!nearFace.sound.isPlaying || nearFace.getVolFade < 1.0)
            {
                nearFace.sound.play();
                nearFace.startVolFade(1);
            }
            continue;
        }
        if(inactiveFacesWithAudio.length > 0)
        {    
            const iFace = inactiveFacesWithAudio[0];
            inactiveFacesWithAudio.shift();     
            iFace.setIsAudioLoading(true);
            nearFace.setIsAudioLoading(true);
            loadBufferToFace(nearFace).then((buffer) =>
            {                
                iFace.setIsAudioLoading(false);
                nearFace.setIsAudioLoading(false);
                const iFInd = facesWithAudio.indexOf(iFace);    
                reassignSound(iFInd, nearFace);
                nearFace.setAudioBuffer(buffer);
                nearFace.playSound();
            });
            return;
        }
        if(facesWithAudio.length < maxAudios)
        {
            const sound = new Three.PositionalAudio(audioListener); 
            sound.setRefDistance(audioRefDist);
            sound.setVolume(audioVol);
            facesWithAudio.push(nearFace);  
            nearFace.mesh.add(sound);
            nearFace.sound = sound;        
                
            const biquadFilter = sound.context.createBiquadFilter();
            biquadFilter.type = "lowpass";
            sound.setFilter(biquadFilter);
            biquadFilter.frequency.setValueAtTime(50, sound.context.currentTime);
            nearFace.filter = biquadFilter; 
            
            nearFace.setIsAudioLoading(true);
            loadBufferToFace(nearFace).then((buffer) =>
            {
                nearFace.setIsAudioLoading(false);
                nearFace.setAudioBuffer(buffer);
                nearFace.playSound();
            });
            return;
        }
        for(let j = activeFacesNearestToFarthest.length - 1; j > i; j--)
        {
            const farFace = activeFacesNearestToFarthest[j].face;
            if(farFace.sound != null)
            {
                nearFace.setIsAudioLoading(true);
                farFace.setIsAudioLoading(true);
                loadBufferToFace(nearFace).then((buffer) =>
                {
                    const fFInd = facesWithAudio.indexOf(farFace);
                    fadeAndSwitchAudio(fFInd, nearFace, buffer);
                });
                return;
            }
        }        
    }
}

function reassignSound(i, faceB)
{
    const faceA = facesWithAudio[i]
    if(faceA.sound)
    {
        faceA.sound.stop();
    }
    faceB.sound = facesWithAudio[i].sound;
    faceB.filter = facesWithAudio[i].filter;
    faceB.mesh.add(faceB.sound);
    faceA.mesh.remove(faceA.sound);
    faceA.sound = null;
    faceA.filter = null;      
    if(faceA.soundTimeout)
    {
        clearTimeout(faceA.soundTimeout);
    }  
    facesWithAudio.splice(i, 1);
    facesWithAudio.push(faceB);
}

function rendererRender()
{    
    composer.render();
}
function updateCameraControls(delta)
{    
    cameraControls.update(delta / 1000.0);
}

function getDelta()
{
    const now = Date.now();
    const delta = now - lastUpdate;
    lastUpdate = now;
    return delta;
}

function updateFaces(delta)
{
    let facesInRange = 0;
    activeFaces.forEach((face) =>
    {        
        face.update(camera, delta);

        if(face.isInRange() && face.isActive) //isActive needed (update() might despawn)
        {
            facesInRange++;
        }
    });
    return facesInRange;
}

function manageDistanceSpawns(facesInRange, delta)
{
    if(!isNewSpawnOn)
    {
        return false;
    }

    spawnTimer += delta;

    if(facesInRange < minNearFaces && activeFaces.length < maxFaces)
    {
        if(spawnTimer > spawnTimerDur)
        {
            spawnTimer = 0.0;
            const range = spawnTimerMaxDur - spawnTimerMinDur;
            spawnTimerDur = Math.pow(Math.random(),2) * range + spawnTimerMinDur;
        }
        else
        {
            return;
        }    
        let data = new FaceData();
        const oldFace = getSpawnData(data); //returns either string or Face()
        if(oldFace == "no more faces")
        {
            return false;
        }
        else if(oldFace == "no old face")
        {
            makeFace(data);
            return true;
        }
        else
        {
            const newPos = getSpawnPos();
            const i = inactiveFaces.indexOf(oldFace);
            inactiveFaces.splice(i, 1);
            activeFaces.push(oldFace);
            oldFace.startSpawn(scene, newPos);
            return true;
        }
        //facesInRange++;
    }
}

function autoMove()
{
    if(!isIdle)
    {
        return;
    }
    const smoothTime = Math.random() * 3 + 2.0;
    const delay = smoothTime * 1000;

    const doNothing = Math.random() > 0.8;
    if(doNothing)
    {
        const to = setTimeout(autoMove, delay);    
        autoMoveQueue.push(to);
        return;
    }

    cameraControls.smoothTime = smoothTime; //1-3 seconds

    const dollyOrRotate = Math.random() > 0.4;
    if(dollyOrRotate)//translate
    {
        const dist = Math.random() * 4 - 1.0;        
        cameraControls.dollyInFixed(dist, true);
    }
    else//rotate
    {
        const azimuth = ((Math.random() - 0.5)) * Math.PI;
        const polar = ((Math.random() - 0.5)) * Math.PI;
        cameraControls.rotate(azimuth, polar, true);
    }
    const to = setTimeout(autoMove, delay);    
    autoMoveQueue.push(to);
}

function getSpawnData(data)
{
    if(facesData.length < 1)
    {
        return "no more faces";
    }
    const ran = Math.floor(Math.random() * facesData.length);

    data.id = facesData[ran].id;
    data.imageUrl = facesData[ran].imageUrl;
    data.audioUrl = facesData[ran].audioUrl;

    const idsFromInactive = inactiveFaces.map(face => face.data.id);
    if(idsFromInactive.includes(data.id))
    {
        const i = idsFromInactive.indexOf(data.id);
        return inactiveFaces[i];
    }
    const idsFromAvailable = facesAvailableData.map(avData => avData.id);
    if(idsFromAvailable.includes(data.id))
    {
        return "no old face";
    }
    
    return "no more faces";
}

function loadTexture(imageUrl)
{
    return new Promise((resolve, reject) => 
    {
        texLoad.load(imageUrl, resolve, undefined, () => { console.log("error loading texture"); reject()});
    });
}

async function makeFace(data, isInitialSpawn=false)
{
    const idsFromAvailable = facesAvailableData.map(avData => avData.id);
    const i = idsFromAvailable.indexOf(data.id);

    facesAvailableData.splice(i, 1);    

    const startPos = getSpawnPos(isInitialSpawn);
    const face = new Face(data, startPos);
        
    activeFaces.push(face);

    const tex = await loadTexture(data.imageUrl);
    const aspect = tex.image.width / tex.image.height;
    addGeometryToFace(face, tex, aspect, startPos);
    face.startSpawn(scene, startPos);
    return face;
}

function onSoundEnd(face)
{
    const delay = Math.random() * (maxAudioWait - minAudioWait) + minAudioWait;
    
    face.soundTimeout = setTimeout( () => 
    {
        face.stopSound(); 
        face.playSound(); 
        face.sound.source.onended = () => onSoundEnd(face);
    }
    , delay);
}

function fadeAndSwitchAudio(i, faceB, buffer)
{
    const faceA = facesWithAudio[i];   
    if(faceA)
    {
        faceA.startVolFade(-1);
    }

    setTimeout(() => 
    {
        faceA.setIsAudioLoading(false);
        faceB.setIsAudioLoading(false);     
        reassignSound(i, faceB);
        faceB.setAudioBuffer(buffer);
        faceB.playSound();
        faceB.startVolFade(1);
    }, furthestVolFadeDur);
}

function loadBufferToFace(face)
{
    return new Promise((resolve, reject) =>
    {
        if(face.audioBuffer)
        {
            resolve(face.audioBuffer);
            return;
        }
        audioLoader.load(face.data.audioUrl, (buffer) =>
        {
            resolve(buffer);   
        });
    });
}

function getSpawnPos(isFrontAndBack=true)
{
    const maxSpawnDist = scrollDir == -1 ? maxSpawnDistForward : maxSpawnDistBack;
    const minSpawnDist = scrollDir == -1 ? minSpawnDistForward : minSpawnDistBack;
    const spawnRange = maxSpawnDist - minSpawnDist;
    let x = (Math.random() - 0.5) * maxSpawnDist * (scrollDir == 1 ? 0.5 : 1.0);
    let y = (Math.random() - 0.5) * maxSpawnDist * (scrollDir == 1 ? 0.5 : 1.0);
    let z;
    if(isFrontAndBack)
    {
        z = (Math.random() - 0.5) * 2 * spawnRange;
    }
    else
    {
        z = -(Math.random() * spawnRange + minSpawnDist);// * zDistAdj;
    }

    const target = new Three.Vector3();
    target.copy(camera.position);
    const relativePos = new Three.Vector3(x, y, z);
    relativePos.applyQuaternion(camera.quaternion);

    return target.add(relativePos);
}

function addGeometryToFace(face, tex, aspect, spawnPos)
{      
    const uniforms =
    {
        u_tex: { value: tex},
        u_vignetteWidth: { value: 1.0 }, //3.0
        u_vignetteStart: { value: 7.0 }, //15.0
        u_vignetteSize: { value: 1.0 },
        u_alpha: { value: 0.0 },
        u_time: { get value() {return 0.001 * performance.now() }},
        u_timeMultX: { value: Math.pow(Math.random(),2) * 0.95 + 0.05 },
        u_timeMultY: { value: Math.pow(Math.random(),2) * 0.95 + 0.05 },
        u_blurStrength: { value: 7.0 },
        u_isTextureGrad: { value: Math.random() > 0.66 }
    }

    const mat = new Three.ShaderMaterial
    ({
        uniforms,
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false
    });

    const geo = new Three.PlaneGeometry(faceScale * aspect, faceScale);
    const plane = new Three.Mesh(geo, mat);

    plane.position.copy(spawnPos);

    face.mesh = plane;
    face.material = mat;
    face.uniforms = uniforms;
    face.texAspect = aspect;
}

export function stopWorld()
{
    if(isAnimating)
    {
        isAnimating = false;
        cancelAnimationFrame( animateId );
    }
}

function getFacesData()
{
    let formData = new FormData();
    formData.append("action", "load_data");

    return new Promise((resolve) =>
    {
        //fetch("http://localhost:80/website/faces/public/database.php", //for dev mode (npm run dev)
        fetch("./database.php",
        {
            method: "POST",
            body: formData
        })
        .then(response => response.json())
        .then(data => 
        {
            const faceArr = data.map(fd => new FaceData(fd.id, fd.imageUrl, fd.audioUrl));
            resolve(faceArr);           
        })
        .catch(error => console.log(error));   
    });
}

function checkForDBChange()
{
    let formData = new FormData();
    formData.append("action", "get_new_faces");
    formData.append("polling_interval", pollingIntervalDur / 1000.0);
    
    //fetch("http://localhost:80/website/faces/public/database.php", //for dev mode (npm run dev)
    fetch("./database.php",
    {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then((data) => 
    {
        const newFaceData = data.map(fd => new FaceData(fd.id, fd.imageUrl, fd.audioUrl));
        for(let i = 0; i < newFaceData.length; ++i)
        {
            const nf = newFaceData[i];
            facesData.push(nf);
            facesAvailableData.push(nf);
            if(activeFaces.length < maxFaces)
            {
                makeFace(nf, true);
                console.log("new face loaded");
            }
        }
        setTimeout(checkForDBChange, pollingIntervalDur);
    });
}

async function setUpPostProcessing(renderer, scene, camera)
{
    const vertFile = await fetch(shadersDir + '/vignette.vert');
    const fragFile = await fetch(shadersDir + '/vignette.frag');
    const v = await vertFile.text();
    const f = await fragFile.text();
    const vignetteShader = 
    {
        uniforms: {
        "tDiffuse": { value: null },
        "u_vignetteWidth": { value: 0.28 },
        "u_vignetteRadius": { value: 0.08 }, //0.02
        "u_vignetteShape": { value: 0.15 } //0.28
        },
        vertexShader: v,
        fragmentShader: f
    };
    
    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const vignettePass = new ShaderPass(vignetteShader);
    composer.addPass(vignettePass);
    composer.depth = false;
}