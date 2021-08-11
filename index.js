const RESCAN_INTERVAL = 100;
const DEFAULT_FPS = 30;
const LOW_BPM = 50;
const HIGH_BPM = 180;
const REL_MIN_FACE_SIZE = 0.4;
const SEC_PER_MIN = 60;
const MSEC_PER_SEC = 1000;
const MAX_CORNERS = 30;
const MIN_CORNERS = 5;
const QUALITY_LEVEL = 0.01;
const MIN_DISTANCE = 1;
const useHarrisDetector = true;
const block_size = 3;

			
const webcamVideoElement = document.getElementById("webcam");
const canvasId = document.getElementById("canvas");
const canvasId2 = document.getElementById("canvas2");
const canvasId3 = document.getElementById("canvas3");
const canvasId4 = document.getElementById("canvas4");


let targetFps = 30;
let windowSize = 5;
let rppgInterval = 450;
let window_frame =1;


let width, height;
var VIEW_WIDTH; 
var VIEW_HEIGHT;
let streaming = false;
let stream=null;
var faceDetector;

let frameRGB;
let init_frame;
let lastFrameGray;
let frameGray ;
let overlayMask ;
let cap;
    // Set variables
let signal = []; // 120 x 3 raw rgb values
let timestamps = []; // 120 x 1 timestamps
let rescan = []; // 120 x 1 rescan bool
let resp_sig =[];
let fpos =[];
let chart_sig1 = [];
let chart_sig2 = [];
let face;  // Position of the face
let scanTimer;
let rppgTimer;
let lastScanTime ;


let bpm = 0;
let rpm = 0;
let lastBPM=0;
let resp = 0;
let rect;

let p0;
let p1;
let frame0;
let frame1;
let st;
let err;
let resp_y =0;
let p1_y;

// parameters for lucas kanade optical flow
let winSize;
let maxLevel;
let criteria;
// Create a mask image for drawing purposes
let zeroEle;
let mask ;
let color = [];
let sig_show =0;
let date1 ;




const SAMPLE_FREQUENCY = 30;
const HPF_CUTOFF = 3;
const LPF_CUTOFF = 1;
const iirCalculator = new Fili.CalcCascades();
const bpfCoeffs = iirCalculator.bandpass({
  order: 2,
  characteristic: 'butterworth',
  Fs: 30,
  Fc: LPF_CUTOFF ,
  Fc2: HPF_CUTOFF,
  gain: 0,
  preGain: false,
});

const bandpassFilter = new Fili.IirFilter(bpfCoeffs);
 

//console.log(filter)



let faceValid=false;
var player = document.getElementById("toggleStream");
var stopbutton = document.getElementById("Stop");
var signal_button = document.getElementById("Signal");




player.addEventListener("click", async function () {

    // Start the video stream
    init();
    
    

    stopbutton.addEventListener("click", async function () {

       stop();
  
    })

    signal_button.addEventListener("click", async function () {
      if(sig_show==0){
       sig_show=1;
       document.getElementById('Signal').innerHTML = "Invisible";
      }
      else{
        sig_show=0;
        document.getElementById('Signal').innerHTML = "Visible";
      }
  
    })

    
    async function startStreaming() {
        try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
            facingMode: 'user',
            width: 1280,
            height:720
            },
            audio: false
        });
        
        } catch (e) {
        console.log(e);
        }
        if (!stream) {
        throw new Error('Could not obtain video from webcam.');
        }
        // Set srcObject to the obtained stream
        webcamVideoElement.srcObject = stream;
        // Start the webcam video stream
        webcamVideoElement.play();
        streaming = true;
        
        return new Promise(resolve => {
        // Add event listener to make sure the webcam has been fully initialized.
        webcamVideoElement.oncanplay = () => {
            resolve();
        };
        });
     }


     async function init() {
       
        try {
          await startStreaming();
          
          webcamVideoElement.width = webcamVideoElement.videoWidth;
          webcamVideoElement.height = webcamVideoElement.videoHeight;
          frameRGB = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC4);
          lastFrameGray = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC1);
          frameGray = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC1);
          overlayMask = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC1);
          frame0 = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC4);
          frame1 = new cv.Mat(webcamVideoElement.height, webcamVideoElement.width, cv.CV_8UC4);
          cap = new cv.VideoCapture(webcamVideoElement);

          VIEW_WIDTH= webcamVideoElement.width;
          VIEW_HEIGHT =  webcamVideoElement.height;

          p0 = new cv.Mat();

          winSize = new cv.Size(75, 75);
          maxLevel = 3;
          criteria = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 30, 0.01);

          


         
          face = new cv.Rect();  // Position of the face

          
          for(var i=0; i<150; i++){
            chart_sig1[i]=0;
            chart_sig2[i]=0;
            
          }

          
          date1 = new Date();
          faceDetector.startDetecting();

          scanTimer = setInterval(processFrame.bind(this),MSEC_PER_SEC/targetFps);   
          rppgTimer = setInterval(rppg.bind(this), rppgInterval);
  
         
        } catch (e) {
          console.log(e);
        }
      }

   
})


function stop() {
  clearInterval(rppgTimer);
  clearInterval(scanTimer);
  
  const stream =webcamVideoElement.srcObject;
  const tracks = stream.getTracks();
  tracks.forEach(track => {
    track.stop();
  });

  invalidateFace();
  //var ctx = canvas.getContext("2d");
  //ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  streaming = false;
  faceValid = false;
  window_frame=1;
  lastBPM=0;
  //frameRGB.delete();
  //lastFrameGray.delete();
  //frameGray.delete();
  
  //err.delete();
  //st.delete();
  //frame0.delete();
  //frame1.delete();
  //resp_y =0;
  //p1_y =0;

}


//face detection function

faceDetector = new FaceDetector(
  {
      video:webcamVideoElement,
      flipLeftRight: false,
      flipUpsideDown: false
  }
);

faceDetector.setOnFaceAddedCallback(function (addedFaces, detectedFaces) {
  console.log(detectedFaces);
  faceValid=true;
  for (var i = 0; i < addedFaces.length; i++) {
      console.log("[facedetector] New face detected id=" + addedFaces[i].faceId + " index=" + addedFaces[i].faceIndex + faceValid);
  }
});

faceDetector.setOnFaceLostCallback(function (lostFaces, detectedFaces) {
  faceValid=false;
  
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  for (var i = 0; i < lostFaces.length; i++) {
      console.log("[facedetector] Face removed id=" + lostFaces[i].faceId + " index=" + lostFaces[i].faceIndex + faceValid);
  }
  invalidateFace();
});

faceDetector.setOnFaceUpdatedCallback(function (detectedFaces) {

  var ctx = canvas.getContext("2d");
 
  ctx.strokeStyle = "#81F781";
  ctx.lineWidth = 3;
  ctx.fillStyle = "red";
  ctx.font = "italic small-caps bold 20px arial";
  

  
  for (var i = 0; i < detectedFaces.length; i++) {


     //ctx.fillText(face.faceId, face.x * VIEW_WIDTH, face.y * VIEW_HEIGHT);
     ctx.strokeRect(face.x * VIEW_WIDTH, face.y * VIEW_HEIGHT, face.width * VIEW_WIDTH, face.height * VIEW_HEIGHT);
     faceValid=true;

  }

  face = detectedFaces[0];
  
});

//face detection function end

function processFrame() {
    try {
          if (!frameGray.empty()) {
              frameGray.copyTo(lastFrameGray); // Save last frame
             }
             
             cap.read(frameRGB); // Save current frame
             let time = Date.now()
             let rescanFlag = false;

             cv.cvtColor(frameRGB, frameGray, cv.COLOR_RGBA2GRAY);

             if(signal.length<2){
               fix_resp(frameGray);
             }
             else{
              resp_y=resp_call(frameGray,lastFrameGray);
             }

   // Need to find the face
     if (!faceValid) {
         lastScanTime = time;   
     }
   // Scheduled face rescan
     else if (time - lastScanTime >= RESCAN_INTERVAL) {
         lastScanTime = time;
         rescanFlag = true;
     }
   // Track face
     else {
     // Disable for now,
     //this.trackFace(this.lastFrameGray, this.frameGray);
      
      }
   // Update the signal
     if (faceValid) {
     // Shift signal buffer
        while (signal.length > targetFps * windowSize) {
             signal.shift();
             timestamps.shift();
             rescan.shift();
            
         }

         while(resp_sig.length>300){
          resp_sig.shift();

         }
     // Get mask
         let mask = new cv.Mat();
         mask = makeMask(frameGray, face);
         //cv.imshow(canvasId, mask);
         // New values
         let means = cv.mean(frameRGB, mask);

         mask.delete();

      // Respiration

         // Add new values to raw signal buffer
         signal.push(means.slice(0, 3));
         timestamps.push(time);
         rescan.push(rescanFlag);
         resp_sig.push(resp_y);
     }
   // Draw face
    
     /*cv.rectangle(frameRGB, new cv.Point(face.x * VIEW_WIDTH, face.y * VIEW_HEIGHT),
     new cv.Point(face.x* VIEW_WIDTH+face.width* VIEW_WIDTH, face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT),
     [0, 255, 0, 255]);*/
   // Apply overlayMask



   
   frameRGB.setTo([255, 0, 0, 255], overlayMask);
   cv.imshow(canvasId, frameRGB);

   
   const date2 = new Date();
   
   const elapsedMSec = date2.getTime() - date1.getTime(); 
   const elapsedSec = elapsedMSec / 1000; 

   var ctx4 = canvasId4.getContext("2d");

  
  
   var timer =  elapsedSec.toFixed(0).toString() + ' '+ 'Sec';
 

   ctx4.fillStyle = "white";
   ctx4.fillRect(0,0,100,100);
   ctx4.fillStyle = "black";
   ctx4.font = "italic small-caps bold 20px arial";
   ctx4.textAlign ='center'
   ctx4.fillText(timer, 50, 50);



 } 
 catch (e) {
   console.log("Error capturing frame:");
   console.log(e);
 }
}



function makeMask(frameGray, face) {
 let result = cv.Mat.zeros(frameGray.rows, frameGray.cols, cv.CV_8UC1);
 let white = new cv.Scalar(255, 255, 255, 255);
 let pt1 = new cv.Point(face.x * VIEW_WIDTH+40, face.y * VIEW_HEIGHT+20);
 let pt2 = new cv.Point(face.x* VIEW_WIDTH+face.width* VIEW_WIDTH-40, face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT-40);
 cv.rectangle(result, pt1, pt2, white, -1);
 return result;
}

// Invalidate the face
function invalidateFace() {
 signal=[];
 timestamps=[];
 rescan=[];
 resp_sig=[];
 overlayMask.setTo([0, 0, 0, 0]);
 face = new cv.Rect();
 //faceValid = false;
 p0 = new cv.Mat();
 p1 = new cv.Mat();


}



// Compute rppg signal and estimate HR
function rppg() {
 // Update fps
 let fps = getFps(timestamps);
 // If valid signal is large enough: estimate
 

 if (signal.length >= targetFps * windowSize) {
   // Work with cv.Mat from here
   
   let signals = cv.matFromArray(signal.length, 1, cv.CV_32FC3,
     [].concat.apply([], signal));
   
   // Filtering
   let pos_result = pos(signals);
   fpos= bandpassFilter.simulate(pos_result )
   //denoise(signals, rescan);
   //standardize(signals);
   //detrend(signals, fps);
   //movingAverage(signals, 3, Math.max(Math.floor(fps/6), 2));
   //signals = selectGreen(signals);

   
   
   var ctx2 = canvasId2.getContext("2d");
   var ctx3 = canvasId3.getContext("2d");

  
   var HR = 'HR:'+ ' ' + bpm.toFixed(0).toString();
   var RR = 'RR:'+ ' ' + resp.toFixed(0).toString();
 
   ctx2.fillStyle = "white";
   ctx2.fillRect(0,0,100,100);
   ctx2.fillStyle = "black";
   ctx2.font = "italic small-caps bold 20px arial";
   ctx2.textAlign ='center'
   ctx2.fillText(HR, 50, 50);


   ctx3.fillStyle = "white";
   ctx3.fillRect(0,0,100,100);
   ctx3.fillStyle = "black";
   ctx3.font = "italic small-caps bold 20px arial";
   ctx3.textAlign ='center'
   ctx3.fillText(RR, 50, 50);


   
    
   let index_07 = math.round(0.7/(15/513));
   let index_4 = math.round(4/(15/513));
   
    

   // HR estimation
   var option = {fftSize: 1024, window: 'hann', _scaling: 'psd'};
   let psd = bci.periodogram(fpos, fps, option);
   let freq=psd.frequencies;
   let pxx = psd.estimates;
   let max = Math.max(...pxx.slice(index_07,index_4));
   let maxloc = pxx.indexOf(max);


   let Pg_sum =0;
   let Pe =createZeroArray(513);
   let h = 1;
   
   if(window_frame==1){
     h=1;
   }
   else if(window_frame>1){
     h=lastBPM;
   }



   // signal Quality
   let r=QSNR(pxx, maxloc, 4);
   let nrom_q  = (r-0.1)/(1.7-0.1);

   

   // Bayesian Tracking
   for(var i=index_07; i<=index_4; i++){
      
    Pg_sum = Pg_sum+ (0.4 + normaldistribution(freq[i], h, nrom_q, 4));

  }

  
  for(var i=index_07; i<=index_4;i++){
    
   Pe[i] = (0.4+ normaldistribution(freq[i], h, nrom_q, 4))/Pg_sum;

  }
  
  let Sum_pxx_hr = sum(pxx.slice(index_07,index_4));
  
  let Pl=[];
  for(var i=0; i<=pxx.length; i++){
    
    Pl[i]=pxx[i]/Sum_pxx_hr;

  }


  let Z=[];

  for(var i=0; i<=pxx.length; i++){
    
    Z[i]=(Pl[i]*Pe[i]);

  }


  

  let Ps = sum(Z.slice(index_07,index_4));

  //posterial
  let Pp=[];
  for(var i=0; i<=pxx.length; i++){
    
    Pp[i]=(Pl[i]*Pe[i])/Ps;

  }

  let Pmax = Math.max(...Pp.slice(index_07,index_4));
  let Pmaxloc = Pp.indexOf(Pmax);
  console.log(nrom_q)
  if(nrom_q>0.3){
    lastBPM =freq[Pmaxloc];
    bpm =freq[Pmaxloc]*60;
  }
  else{
    lastBPM =h;
    bpm =lastBPM*60;
  }

 

   let pos_sig = cv.matFromArray(signal.length, 1, cv.CV_32FC1, fpos);
   
   // Draw time domain signal
   overlayMask.setTo([0, 0, 0, 0]);
   if (sig_show==1){

    drawTime(pos_sig);
   }

   pos_sig.delete();
   window_frame=window_frame+1;

  // timeToFrequency( pos_sig, true);
  
  // timeToFrequency(resp_signals, true);
   // Calculate band spectrum limits
   //let low = Math.floor( pos_sig.rows * LOW_BPM / SEC_PER_MIN / fps);
   //let high = Math.ceil( pos_sig.rows * HIGH_BPM / SEC_PER_MIN / fps);
   

   /* if (! pos_sig.empty()) {
     // Mask for infeasible frequencies
    
     let bandMask = cv.matFromArray( pos_sig.rows, 1, cv.CV_8U,
       new Array( pos_sig.rows).fill(0).fill(1, low, high+1));

     
     //drawFrequency(resp_signals, low_resp, high_resp, rsep_bandMask);
     // Identify feasible frequency with maximum magnitude
     let result = cv.minMaxLoc(pos_sig, bandMask);

     
     console.log(pos_sig.rows);
     bandMask.delete();

     
     
     // Infer BPM
     bpm = result.maxLoc.y * fps / pos_sig.rows * SEC_PER_MIN;

     console.log(result.maxLoc.y, fps, bpm);

    
     //console.log(bpm);
     // Draw BPM
     //drawBPM(bpm);
   }*/
  
 } else {
   console.log("signal too small");
 }

if (resp_sig.length >= 300) {
   // Work with cv.Mat from here
   
   let resp_signals = cv.matFromArray(resp_sig.length, 1, cv.CV_32FC1,resp_sig);
   
   // Filtering
   movingAverage(resp_signals, 3, Math.max(Math.floor(fps/6), 2));


   // Draw time domain signal
   if(sig_show==1){
   drawresp(resp_signals);
    }
   let res= peakdet(resp_sig,0.5);
 
   resp=res.peaks.length * 3;
   

   if (!resp_signals.empty()) {

     //drawFPS(resp);
   }
   resp_signals.delete();
 } else {
   console.log("signal too small");
 }



}



//Respiration
function fix_resp(lastFrameGray){
  
  if(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT+100<lastFrameGray.cols){
     rect = new cv.Rect(Math.round(face.x* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT),
     Math.round(face.width* VIEW_WIDTH),100);
    
   }
   else{
     rect = new cv.Rect(Math.round(face.x* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT),
     Math.round(face.width* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT+100)-lastFrameGray.cols);
     
   }
  
   
   frame0 = new cv.Mat();
   frame0 = lastFrameGray.roi(rect);
 
   //cv.imshow(canvasId2, frame0);
   //
 
   let none = new cv.Mat();
 
   p0 = new cv.Mat();
   
   cv.goodFeaturesToTrack(frame0, p0,  MAX_CORNERS, QUALITY_LEVEL, MIN_DISTANCE,
     none, block_size, useHarrisDetector,0.05 );

  }
 
  
  function resp_call(frameGray,lastFrameGray){
 
   if(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT+100<lastFrameGray.cols){
     rect = new cv.Rect(Math.round(face.x* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT),
     Math.round(face.width* VIEW_WIDTH),100);
    
   }
   else{
     rect = new cv.Rect(Math.round(face.x* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT),
     Math.round(face.width* VIEW_WIDTH),Math.round(face.y* VIEW_HEIGHT+face.height* VIEW_HEIGHT+100)-lastFrameGray.cols);
     
   }
 
   frame0 = new cv.Mat();
   frame0 = lastFrameGray.roi(rect);
   frame1 = new cv.Mat();
   frame1 = frameGray.roi(rect);
 
   p1 = new cv.Mat();
   st = new cv.Mat();
   err = new cv.Mat();
 
   cv.calcOpticalFlowPyrLK(frame0, frame1, p0, p1, st, err, winSize, maxLevel, criteria);
 
    // select good points
    let goodNew = [];
    let goodOld = [];
    for (let i = 0; i < st.rows; i++) {
        if (st.data[i] === 1) {
            goodNew.push(new cv.Point(p1.data32F[i*2], p1.data32F[i*2+1]));
            goodOld.push(new cv.Point(p0.data32F[i*2], p0.data32F[i*2+1]));
        }
    }
    let result=0;
    for (let i = 0; i <goodNew.length; i++) {
      result += goodNew[i].y;
    }
    p1_y = result / goodNew.length;



    p0.delete(); p0 = null;
    p0 = new cv.Mat(goodNew.length, 1, cv.CV_32FC2);
    for (let i = 0; i < goodNew.length; i++) {
      p0.data32F[i*2] = goodNew[i].x;
      p0.data32F[i*2+1] = goodNew[i].y;
    }

   return p1_y;
 
 }
//respiration end 



// Calculate fps from timestamps
function getFps(timestamps, timeBase=1000) {
 if (Array.isArray(timestamps) && timestamps.length) {
   if (timestamps.length == 1) {
     return DEFAULT_FPS;
   } else {
     let diff = timestamps[timestamps.length-1] - timestamps[0];
     return timestamps.length/diff*timeBase;
   }
 } else {
   return DEFAULT_FPS;
 }
}

// Remove noise from face rescanning
function denoise(signal, rescan) {
 let diff = new cv.Mat();
 cv.subtract(signal.rowRange(1, signal.rows), signal.rowRange(0, signal.rows-1), diff);
 for (var i = 1; i < signal.rows; i++) {
   if (rescan[i] == true) {
     let adjV = new cv.MatVector();
     let adjR = cv.matFromArray(signal.rows, 1, cv.CV_32FC1,
       new Array(signal.rows).fill(0).fill(diff.data32F[(i-1)*3], i, signal.rows));
     let adjG = cv.matFromArray(signal.rows, 1, cv.CV_32FC1,
       new Array(signal.rows).fill(0).fill(diff.data32F[(i-1)*3+1], i, signal.rows));
     let adjB = cv.matFromArray(signal.rows, 1, cv.CV_32FC1,
       new Array(signal.rows).fill(0).fill(diff.data32F[(i-1)*3+2], i, signal.rows));
     adjV.push_back(adjR); adjV.push_back(adjG); adjV.push_back(adjB);
     let adj = new cv.Mat();
     cv.merge(adjV, adj);
     cv.subtract(signal, adj, signal);
     adjV.delete(); adjR.delete(); adjG.delete(); adjB.delete();
     adj.delete();
   }
 }
 diff.delete();
}
// Standardize signal
function standardize(signal) {
 let mean = new cv.Mat();
 let stdDev = new cv.Mat();
 let t1 = new cv.Mat();
 cv.meanStdDev(signal, mean, stdDev, t1);
 let means_c3 = cv.matFromArray(1, 1, cv.CV_32FC3, [mean.data64F[0], mean.data64F[1], mean.data64F[2]]);
 let stdDev_c3 = cv.matFromArray(1, 1, cv.CV_32FC3, [stdDev.data64F[0], stdDev.data64F[1], stdDev.data64F[2]]);
 let means = new cv.Mat(signal.rows, 1, cv.CV_32FC3);
 let stdDevs = new cv.Mat(signal.rows, 1, cv.CV_32FC3);
 cv.repeat(means_c3, signal.rows, 1, means);
 cv.repeat(stdDev_c3, signal.rows, 1, stdDevs);
 cv.subtract(signal, means, signal, t1, -1);
 cv.divide(signal, stdDevs, signal, 1, -1);
 mean.delete(); stdDev.delete(); t1.delete();
 means_c3.delete(); stdDev_c3.delete();
 means.delete(); stdDevs.delete();
}

// Remove trend in signal
function detrend(signal, lambda) {
 let h = cv.Mat.zeros(signal.rows-2, signal.rows, cv.CV_32FC1);
 let i = cv.Mat.eye(signal.rows, signal.rows, cv.CV_32FC1);
 let t1 = cv.Mat.ones(signal.rows-2, 1, cv.CV_32FC1)
 let t2 = cv.matFromArray(signal.rows-2, 1, cv.CV_32FC1,
   new Array(signal.rows-2).fill(-2));
 let t3 = new cv.Mat();
 t1.copyTo(h.diag(0)); t2.copyTo(h.diag(1)); t1.copyTo(h.diag(2));
 cv.gemm(h, h, lambda*lambda, t3, 0, h, cv.GEMM_1_T);
 cv.add(i, h, h, t3, -1);
 cv.invert(h, h, cv.DECOMP_LU);
 cv.subtract(i, h, h, t3, -1);
 let s = new cv.MatVector();
 cv.split(signal, s);
 cv.gemm(h, s.get(0), 1, t3, 0, s.get(0), 0);
 cv.gemm(h, s.get(1), 1, t3, 0, s.get(1), 0);
 cv.gemm(h, s.get(2), 1, t3, 0, s.get(2), 0);
 cv.merge(s, signal);
 h.delete(); i.delete();
 t1.delete(); t2.delete(); t3.delete();
 s.delete();
}
// Moving average on signal
function movingAverage(signal, n, kernelSize) {
 for (var i = 0; i < n; i++) {
   cv.blur(signal, signal, {height: kernelSize, width: 1});
 }
}
// TODO solve this more elegantly
function selectGreen(signal) {
 let rgb = new cv.MatVector();
 cv.split(signal, rgb);
 // TODO possible memory leak, delete rgb?
 let result = rgb.get(1);
 //console.log(result.data32F);
 rgb.delete();
 return result;
}
// Convert from time to frequency domain
function timeToFrequency(signal, magnitude) {
 // Prepare planes
 let planes = new cv.MatVector();
 planes.push_back(signal);
 planes.push_back(new cv.Mat.zeros(signal.rows, 1, cv.CV_32F))
 let powerSpectrum = new cv.Mat();
 cv.merge(planes, signal);
 // Fourier transform
 cv.dft(signal, signal, cv.DFT_COMPLEX_OUTPUT);
 if (magnitude) {
   cv.split(signal, planes);
   cv.magnitude(planes.get(0), planes.get(1), signal);
 }

}
// Draw time domain signal to overlayMask
function drawTime(signal) {
 // Display size
 let displayHeight = face.height* VIEW_HEIGHT/2.0;
 let displayWidth = face.width* VIEW_WIDTH*0.8;
 // Signal
 let result = cv.minMaxLoc(signal);
 let heightMult = displayHeight/(result.maxVal-result.minVal);
 let widthMult = displayWidth/(signal.rows-1);
 let drawAreaTlX = face.x * VIEW_WIDTH + face.width * VIEW_WIDTH + 10;
 let drawAreaTlY =  face.y * VIEW_HEIGHT
 let start = new cv.Point(drawAreaTlX,
   drawAreaTlY+(result.maxVal-signal.data32F[0])*heightMult);
 for (var i = 1; i < signal.rows; i++) {
   let end = new cv.Point(drawAreaTlX+i*widthMult,
     drawAreaTlY+(result.maxVal-signal.data32F[i])*heightMult);
   cv.line(overlayMask, start, end, [255, 255, 255, 255], 2, cv.LINE_4, 0);
   start = end;
 }
}


// Draw time domain respiration signal to overlayMask
function drawresp(signal) {
  // Display size
  let displayHeight = face.height* VIEW_HEIGHT/2.0;
  let displayWidth = face.width* VIEW_WIDTH*0.8;
  // Signal
  let result = cv.minMaxLoc(signal);
  let heightMult = displayHeight/(result.maxVal-result.minVal);
  let widthMult = displayWidth/(signal.rows-1);
  let drawAreaTlX = face.x* VIEW_WIDTH + face.width* VIEW_WIDTH + 10;
  let drawAreaTlY = face.y* VIEW_HEIGHT + face.height* VIEW_HEIGHT/2.0;
  let start = new cv.Point(drawAreaTlX,
    drawAreaTlY+(result.maxVal-signal.data32F[0])*heightMult);
  for (var i = 1; i < signal.rows; i++) {
    let end = new cv.Point(drawAreaTlX+i*widthMult,
      drawAreaTlY+(result.maxVal-signal.data32F[i])*heightMult);
    cv.line(overlayMask, start, end, [255, 255, 255, 255], 2, cv.LINE_4, 0);
    start = end;
  }
 }

// Draw frequency domain signal to overlayMask
function drawFrequency(signal, low, high, bandMask) {
 // Display size
 let displayHeight = face.height* VIEW_HEIGHT/2.0;
 let displayWidth = face.width* VIEW_WIDTH*0.8;
 // Signal
 let result = cv.minMaxLoc(signal, bandMask);
 let heightMult = displayHeight/(result.maxVal-result.minVal);
 let widthMult = displayWidth/(high-low);
 let drawAreaTlX = face.x* VIEW_WIDTH + face.width* VIEW_WIDTH + 10;
 let drawAreaTlY = face.y* VIEW_HEIGHT + face.height* VIEW_HEIGHT/2.0;
 let start = new cv.Point(drawAreaTlX,
   drawAreaTlY+(result.maxVal-signal.data32F[low])*heightMult);
 for (var i = low + 1; i <= high; i++) {
   let end = new cv.Point(drawAreaTlX+(i-low)*widthMult,
     drawAreaTlY+(result.maxVal-signal.data32F[i])*heightMult);
   cv.line(overlayMask, start, end, [255, 0, 0, 255], 2, cv.LINE_4, 0);
   start = end;
 }
}
// Draw tracking corners
function drawCorners(corners) {
 for (var i = 0; i < corners.rows; i++) {
   cv.circle(frameRGB, new cv.Point(
     corners.data32F[i*2], corners.data32F[i*2+1]),
     5, [0, 255, 0, 255], -1);
   //circle(frameRGB, corners[i], r, WHITE, -1, 8, 0);
   //line(frameRGB, Point(corners[i].x-5,corners[i].y), Point(corners[i].x+5,corners[i].y), GREEN, 1);
   //line(frameRGB, Point(corners[i].x,corners[i].y-5), Point(corners[i].x,corners[i].y+5), GREEN, 1);
 }
}
// Draw bpm string to overlayMask
function drawBPM(bpm) {
   cv.putText(overlayMask, bpm.toFixed(0).toString(),
   new cv.Point(face.x* VIEW_WIDTH, face.y* VIEW_HEIGHT - 10),
   cv.FONT_HERSHEY_PLAIN, 1.5, [255, 0, 0, 255], 2);
}

function drawFPS(fps) {
 cv.putText(overlayMask, fps.toFixed(0).toString(),
   new cv.Point(face.x* VIEW_WIDTH+60, face.y* VIEW_HEIGHT - 10),
   cv.FONT_HERSHEY_PLAIN, 1.5, [255, 0, 0, 255], 2);
}



function drawChart(signal){
  
  let time =[];

  time[0] = 0;

  for(var i=1; i<signal.length; i++){
    time[i]=1/30+time[i-1];
  }



  

  new Chart(document.getElementById("canvas2"), {
    
    type: 'line',
    data: {
      labels: time,
      datasets: [{ 
          //data: ajson[1].value,
          data: signal,
          //label: "ref",
          pointRadius: 0,
          borderColor: "white",
          fill: false
        }
      ]
    },

    options: {
      responsive: false,
      animation: {
        duration: 0
      },
 
        
      legend: {
        display: false
      },  
      scales: {
        
        

        xAxes: [
          {
            ticks: {

              display: false,
             },
             gridLines: {
               display:false
             }
            
          }
         ],
        yAxes: [{
          ticks: {
            beginAtZero: true,
            steps: 0.1,
            stepValue: 0.1,
            max: 1,
            display: false,
           },
           gridLines: {
               display:false
           } 
        
       }]
      }
    }

  });

}



function drawChart2(signal){
  
  let time =[];

  time[0] = 0;

  for(var i=1; i<signal.length; i++){
    time[i]=1/30+time[i-1];
  }


  

  new Chart(document.getElementById("canvas3"), {
    
    type: 'line',
    data: {
      labels: time,
      datasets: [{ 
          //data: ajson[1].value,
          data: signal,
          //label: "ref",
          pointRadius: 0,
          borderColor: "white",
          fill: false
        }
      ]
    },

    options: {
      responsive: false,
      animation: {
        duration: 0
      },
      legend: {
        display: false
      },  
      scales: {
        animation: false,
        scaleOverride: true,
        scaleSteps: 0.1,
        //Number - The value jump in the hard coded scale
        scaleStepWidth: 1,
        //Number - The scale starting value
        scaleStartValue: 0,
        

        xAxes: [
          {
            ticks: {
              display: false
             },
             gridLines: {
               display:false
             }
            
          }
         ],
        yAxes: [{
           gridLines: {
               display:false
           } 
        
       }]
      }
    }

  });

}

  
function peakdet(data, delta){
  //console.log("data is " + data)
  //console.log("delta is " + delta)

  var peaks = [];
  var valleys = [];

  var min = Infinity;
  var max = -Infinity;
  var minPosition = Number.NaN;
  var maxPosition = Number.NaN;

  var lookForMax = true;

  var current;
  // var dbg = [];
  for(var i=0; i < data.length; i++){
      current = parseFloat(data[i]);
      if (isNaN(current) || !isFinite(current)) {
        alert("Item that's not a number!");
        break;
      }
      if (current > max){
          max = current;
          maxPosition = i;
      }
      if (current < min){
          min = current;
          minPosition = i;
      }
      /*
      dbg.push(
        "looking for max," + lookForMax + ",current," + current + ",pos," +
        i + ",min," + min + ",max," + max + ",delta," + delta + "<br>")
      */

      if (lookForMax){
          if (current < max - delta){
              peaks.push({ "position" : maxPosition, "value" : max});
              min = current;
              minPosition = i;
              lookForMax = false;
          }
      }
      else {
          if (current > min + delta) {
              valleys.push({"position" : minPosition, "value" : min});
              max = current;
              maxPosition = i;
              lookForMax = true;
          }
      }
  }
  return {"peaks" : peaks, "valleys" : valleys};
}


function pos(signal){



  let H = [];
  let rgb = new cv.MatVector();
  cv.split(signal, rgb);
  
  let red_resutl = rgb.get(0);
  let green_resutl = rgb.get(1);
  let blue_resutl = rgb.get(2);
  

  let red=red_resutl.data32F;
  let green=green_resutl.data32F;
  let blue=blue_resutl.data32F;

  red =  Array.prototype.slice.call(red);
  green =  Array.prototype.slice.call(green);
  blue =  Array.prototype.slice.call(blue);

  //console.log(red,green,blue)




  let vred = nj.array([red]);
  let vgreen = nj.array([green]);
  let vblue = nj.array([blue]);


  let C = [red,green,blue];
  let mean_red = vred.mean();
  let mean_green = vgreen.mean();
  let mean_blue = vblue.mean();
  let mean_color = nj.array([mean_red, mean_green, mean_blue]);

  let a= [[1,2],[3,4]];

  let diag_mean_color = nj.diag(mean_color);
  let b=[[diag_mean_color.selection.data[0],diag_mean_color.selection.data[1],diag_mean_color.selection.data[2]], 
  [diag_mean_color.selection.data[3],diag_mean_color.selection.data[4],diag_mean_color.selection.data[5]],
  [diag_mean_color.selection.data[6],diag_mean_color.selection.data[7],diag_mean_color.selection.data[8]]]
  
  let diag_mean_color_inv = math.inv(b);
  

  
  let Cn=multiply(diag_mean_color_inv, C);

  
  for(var i=0; i<C.length; i++){
    Cn[0][i]=Cn[0][i]-1;
    Cn[1][i]=Cn[1][i]-1;
    Cn[2][i]=Cn[2][i]-1;
  }


  let projection_matrix = [[0,1,-1],[-2,1,1]];
  let S=multiply(projection_matrix,Cn);

 
 

  let std = [1, math.std(S[0])/math.std(S[1])];

  //console.log(std,S)
  let P = math.multiply(std,S);
  for(var i=0; i<P.length; i++){
      H[i] = (P[i]-math.mean(P))/math.std(P);
      
           
  }
  
  
  return H




}

function multiply (a, b) {
  const transpose = (a) => a[0].map((x, i) => a.map((y) => y[i]));
  const dotproduct = (a, b) => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
  const result = (a, b) => a.map((x) => transpose(b).map((y) => dotproduct(x, y)));
  return result(a, b);
}




function QSNR(spectrum, maxloc, np){
    
  let Sp=sum(spectrum.slice(maxloc-np,maxloc+np));
  let sum_Sp=sum(spectrum);
  let q = Sp/(sum_Sp-Sp);
  
  return q;

}



function normaldistribution(theta, h, gamma, c){
  let sigma =gamma/c
  let Pg = 1/(sigma*Math.sqrt(2*Math.PI,2))*Math.exp(-(theta-h)*(theta-h)/(2*sigma*sigma));
  return Pg;
}


function sum(array) {
  var result = 0.0;

  for (var i = 0; i < array.length; i++)
    result += array[i];

  return result;
}

function createZeroArray(len) {
  return new Array(len).fill(0);
}


/*
function makeSignature() {
  
	var space = " ";				// one space
	var newLine = "\n";				// new line
	var method = "POST";				// method
	var url = "/risk_calculator/v1/cardio_risk?gender=0&age=36&height=175&weight=70&belly=34&act=0&smoke=1&diabetes=0&dia=67&sys=294";	// url (include query string)
	var timestamp = Date.now().toString();			// current timestamp (epoch)
	var accessKey = "PbDvaXxkTaHf19QGViU1"			// access key id (from portal or sub account)
	var secretKey = "HOAg4vr7bjzHr4OvMeAvw70Ae8nNKa6ctudDJuJy";			// secret key (from portal or sub account)

	var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
	hmac.update(method);
	hmac.update(space);
	hmac.update(url);
	hmac.update(newLine);
	hmac.update(timestamp);
	hmac.update(newLine);
	hmac.update(accessKey);

  var hash = hmac.finalize();
  var signature = hash.toString(CryptoJS.enc.Base64);

  return [signature, timestamp];



  
}*/

