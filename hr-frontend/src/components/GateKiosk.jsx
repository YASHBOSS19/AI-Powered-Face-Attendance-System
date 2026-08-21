import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  RefreshCw, 
  FlipHorizontal, 
  Maximize, 
  Minimize, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Play, 
  Pause, 
  ArrowLeft,
  UserCheck,
  LogIn,
  LogOut,
  X
} from 'lucide-react';
import { apiCall } from '../api';

export default function GateKiosk() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [isFlipped, setIsFlipped] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);
  const [resetCountdown, setResetCountdown] = useState(0);

  // Time & Date state
  const [currentTime, setCurrentTime] = useState(new Date());

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const autoScanTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isProcessingRef = useRef(false);
  const voicesRef = useRef([]);

  useEffect(() => {
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Text-to-Speech Helper
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 1.0;
      msg.pitch = 1.5; // High pitch, pleasant
      
      const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      let femaleVoice = voices.find(voice => 
        voice.name.includes('Google UK English Female') ||
        voice.name.includes('Zira') ||
        voice.name.includes('Hazel') ||
        voice.name.includes('Samantha') ||
        voice.name.includes('Victoria')
      );
      
      if (!femaleVoice) {
        femaleVoice = voices.find(voice => voice.name.toLowerCase().includes('female'));
      }
      
      if (!femaleVoice && voices.length > 0) {
        femaleVoice = voices.find(voice => !voice.name.toLowerCase().includes('david') && !voice.name.toLowerCase().includes('male'));
      }
      
      if (femaleVoice) {
        msg.voice = femaleVoice;
      }

      window.speechSynthesis.speak(msg);
    }
  };

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Start webcam on mount
  useEffect(() => {
    startWebcam();
    return () => {
      stopWebcam();
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Auto-scan interval when capturing & autoScan is ON and not displaying a result
  useEffect(() => {
    if (isCapturing && autoScan && !recognitionResult && !loading && !actionLoading) {
      autoScanTimerRef.current = setInterval(() => {
        if (!isProcessingRef.current) {
          scanFace();
        }
      }, 2500);
    } else {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    }
    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, [isCapturing, autoScan, recognitionResult, loading, actionLoading]);

  // Handle result reset countdown
  useEffect(() => {
    if (recognitionResult) {
      const initialTime = recognitionResult.type === 'prompt' ? 6 : 4;
      setResetCountdown(initialTime);
      countdownIntervalRef.current = setInterval(() => {
        setResetCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            setRecognitionResult(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [recognitionResult]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCapturing(true);
    } catch (err) {
      console.error('Error accessing webcam', err);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
  };

  const scanFace = async () => {
    if (!videoRef.current || !isCapturing || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      isProcessingRef.current = false;
      setLoading(false);
      return;
    }

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    
    // Only capture the central square (matching the UI bounding box) to prevent scanning background faces
    const TARGET_SIZE = 480;
    canvas.width = TARGET_SIZE;
    canvas.height = TARGET_SIZE;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Crop a square from the center of the original video feed
    const cropSize = Math.min(vw, vh);
    const startX = (vw - cropSize) / 2;
    const startY = (vh - cropSize) / 2;

    if (isFlipped) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, startX, startY, cropSize, cropSize, 0, 0, TARGET_SIZE, TARGET_SIZE);
      ctx.restore();
    } else {
      ctx.drawImage(video, startX, startY, cropSize, cropSize, 0, 0, TARGET_SIZE, TARGET_SIZE);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    try {
      const data = await apiCall('/recognize', {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl, threshold: 0.35 })
      });

      const facesList = data.faces || data.recognitions || [];
      if (data.status === 'success' && facesList.length > 0) {
        const first = facesList[0];
        if (first.name && first.name !== 'unknown') {
          const displayName = first.name;
          const empId = first.employee_id || '';

          setRecognitionResult({
            type: 'prompt',
            rawName: first.name,
            displayName,
            empId,
            confidence: (first.confidence * 100).toFixed(1),
            todayStatus: first.today_status || {}
          });
        } else {
          setRecognitionResult({
            type: 'unknown',
            message: 'Unrecognized Face'
          });
        }
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleAttendanceAction = async (actionType) => {
    if (!recognitionResult || !recognitionResult.rawName) return;

    setActionLoading(true);
    try {
      const res = await apiCall('/attendance/action', {
        method: 'POST',
        body: JSON.stringify({
          action: actionType,
          name: recognitionResult.displayName,
          employee_id: recognitionResult.empId
        })
      });

      const outcome = res.result || {};
      const statusMsg = outcome.message || (actionType === 'checkin' ? 'Check-in Recorded' : 'Check-out Recorded');
      const isAlreadyCheckedIn = statusMsg.toLowerCase().includes('already');
      const firstName = recognitionResult.displayName.split(' ')[0];

      if (isAlreadyCheckedIn) {
        speak(`Sorry ${firstName}, you already have checked in.`);
      } else if (actionType === 'checkin') {
        speak(`Good morning ${firstName}, thank you for checking in.`);
      } else if (actionType === 'checkout') {
        speak(`Thank you ${firstName} for checking out, have a nice day.`);
      }

      setRecognitionResult({
        type: 'confirmed',
        displayName: recognitionResult.displayName,
        empId: recognitionResult.empId,
        action: actionType,
        message: statusMsg,
        status: (outcome.status || 'present').toUpperCase(),
        time: actionType === 'checkin' ? outcome.checkin : outcome.checkout
      });
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const dismissPrompt = () => {
    setRecognitionResult(null);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="w-screen h-screen bg-slate-900 text-slate-800 flex flex-col items-center justify-center select-none font-sans overflow-hidden relative">
      
      {/* Live Camera Background (Moved outside 3D context to prevent mirroring bugs) */}
      <div className="absolute inset-0 z-0">
        {!isCapturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-600 z-10">
            <Camera size={64} className="mb-4 opacity-40 animate-bounce" />
            <p className="text-lg font-medium">Camera Stopped</p>
            <button 
              onClick={startWebcam} 
              className="mt-4 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-md"
            >
              Start Camera
            </button>
          </div>
        )}
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ transform: isFlipped ? 'scaleX(-1)' : 'none' }}
          className={`w-full h-full object-cover ${isCapturing ? 'block' : 'hidden'}`} 
        />
      </div>

      {/* Live Clock Display (Overlay) */}
      <div className="absolute top-8 right-10 z-50 text-right">
        <div className="text-4xl font-light tracking-wider text-white font-mono drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{formattedTime}</div>
        <div className="text-base text-slate-200 font-medium drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{formattedDate}</div>
      </div>

      {/* Optional Fullscreen Exit Control */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-50">
        <a 
          href="/"
          className="p-3.5 rounded-2xl bg-black/20 backdrop-blur-md hover:bg-black/40 text-white transition shadow-lg border border-white/20"
          title="Return to HR Portal"
        >
          <ArrowLeft size={20} />
        </a>
        <button 
          onClick={toggleFullscreen}
          className="p-3.5 rounded-2xl bg-black/20 backdrop-blur-md hover:bg-black/40 text-white transition shadow-lg border border-white/20"
          title="Toggle Fullscreen Kiosk"
        >
          {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>

      {/* Main Full-Screen Container */}
      <div className="w-full h-full relative z-10 flex items-center justify-center pointer-events-none">
          
          <canvas ref={canvasRef} className="hidden"></canvas>

          {/* Viewfinder Target Frame */}
          {isCapturing && !recognitionResult && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              <div className={`relative w-full max-w-[320px] sm:max-w-[450px] aspect-square rounded-3xl border-2 transition-all duration-300 ${
                loading ? 'border-blue-500 scale-105 shadow-[0_0_30px_rgba(59,130,246,0.4)]' : 'border-white/50'
              }`}>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl translate-x-1 translate-y-1"></div>
              </div>

              <div className="mt-8 px-8 py-3 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 text-sm font-semibold tracking-wide text-slate-700 flex items-center gap-2 shadow-xl pointer-events-auto">
                {loading ? (
                  <><RefreshCw className="animate-spin text-blue-600" size={18} /> Scanning Face...</>
                ) : autoScan ? (
                  <><span className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></span> Stand in front of camera</>
                ) : (
                  <><Pause className="text-amber-500" size={18} /> Auto-Scan Paused</>
                )}
              </div>
            </div>
          )}

          {/* Overlay Controls */}
          {isCapturing && !recognitionResult && (
            <div className="absolute bottom-8 left-8 flex items-center gap-4 pointer-events-auto">
              <button 
                onClick={() => setIsFlipped(!isFlipped)}
                className="p-4 rounded-2xl bg-white/95 backdrop-blur-md hover:bg-slate-50 text-slate-700 border border-slate-200 transition flex items-center gap-2 shadow-xl"
                title="Toggle Mirror View"
              >
                <FlipHorizontal size={20} />
              </button>

              <button 
                onClick={() => setAutoScan(!autoScan)}
                className={`px-6 py-4 rounded-2xl backdrop-blur-md font-semibold text-sm transition border flex items-center gap-2 shadow-xl ${
                  autoScan 
                    ? 'bg-blue-50/95 border-blue-200 text-blue-700 hover:bg-blue-100' 
                    : 'bg-amber-50/95 border-amber-200 text-amber-700 hover:bg-amber-100'
                }`}
              >
                {autoScan ? <Pause size={18} /> : <Play size={18} />}
                <span>{autoScan ? 'Pause Auto-Scan' : 'Resume Auto-Scan'}</span>
              </button>
            </div>
          )}

          {/* Information Overlay */}
          {recognitionResult && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex flex-col items-center justify-center pointer-events-auto animate-in fade-in zoom-in-95 duration-300 p-8 text-white text-center">
               
               {recognitionResult.type === 'prompt' && (
                 <>
                   <button 
                     onClick={dismissPrompt}
                     className="absolute top-8 right-8 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition"
                     title="Dismiss"
                   >
                     <X size={32} />
                   </button>

                   <h2 className="text-5xl md:text-7xl font-black tracking-tight drop-shadow-2xl mb-4">{recognitionResult.displayName}</h2>
                   
                   {recognitionResult.empId && (
                     <p className="text-xl md:text-2xl font-mono text-white/70 uppercase tracking-wider mb-8 drop-shadow-lg">ID: {recognitionResult.empId}</p>
                   )}

                   {/* Today Status */}
                   {recognitionResult.todayStatus?.has_record ? (
                     <div className="text-2xl font-semibold text-blue-300 drop-shadow-lg mb-10">
                       Today: Check-in {recognitionResult.todayStatus.checkin}
                       {recognitionResult.todayStatus.checkout ? ` | Check-out ${recognitionResult.todayStatus.checkout}` : ''}
                     </div>
                   ) : (
                     <div className="text-2xl font-semibold text-white/50 drop-shadow-lg mb-10">Not checked in today</div>
                   )}

                   {recognitionResult.todayStatus?.checkout ? (
                     <div className="text-3xl md:text-4xl font-bold text-green-400 drop-shadow-2xl flex items-center justify-center gap-4">
                       <CheckCircle2 size={40} /> Attendance Completed for Today
                     </div>
                   ) : (
                     <div className="flex gap-6 w-full max-w-2xl mt-4">
                         {!recognitionResult.todayStatus?.has_record && (
                           <button
                             onClick={() => handleAttendanceAction('checkin')}
                             disabled={actionLoading}
                             className="flex-1 bg-green-500/80 hover:bg-green-500 backdrop-blur-md text-white font-bold py-6 rounded-[2rem] border border-green-400/50 shadow-[0_0_40px_rgba(34,197,94,0.3)] transition flex items-center justify-center gap-3 text-2xl disabled:opacity-50"
                           >
                             {actionLoading ? <RefreshCw className="animate-spin" size={28} /> : <LogIn size={28} />}
                             <span>Check In</span>
                           </button>
                         )}

                         {recognitionResult.todayStatus?.has_record && !recognitionResult.todayStatus?.checkout && (
                           <button
                             onClick={() => handleAttendanceAction('checkout')}
                             disabled={actionLoading}
                             className="flex-1 bg-blue-500/80 hover:bg-blue-500 backdrop-blur-md text-white font-bold py-6 rounded-[2rem] border border-blue-400/50 shadow-[0_0_40px_rgba(59,130,246,0.3)] transition flex items-center justify-center gap-3 text-2xl disabled:opacity-50"
                           >
                             {actionLoading ? <RefreshCw className="animate-spin" size={28} /> : <LogOut size={28} />}
                             <span>Check Out</span>
                           </button>
                         )}
                     </div>
                   )}

                   <div className="absolute bottom-12 left-0 right-0">
                     <div className="h-1.5 w-full max-w-md mx-auto bg-white/20 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-white/80 transition-all duration-1000 ease-linear"
                         style={{ width: `${(resetCountdown / 6) * 100}%` }}
                       ></div>
                     </div>
                     <p className="text-sm text-white/50 mt-4 flex items-center justify-center gap-1.5 font-medium">
                       <Clock size={16} /> Auto-dismissing in {resetCountdown}s...
                     </p>
                   </div>
                 </>
               )}

               {recognitionResult.type === 'confirmed' && (
                 <>
                   <CheckCircle2 size={120} className="text-green-400 drop-shadow-2xl mb-8 animate-in bounce-in" />
                   <h2 className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl mb-4">{recognitionResult.displayName}</h2>
                   <p className="text-3xl md:text-4xl font-semibold text-green-300 drop-shadow-xl">{recognitionResult.message}</p>
                   
                   {recognitionResult.time && (
                     <p className="text-2xl font-mono text-white/70 mt-8 drop-shadow-lg">Timestamp: {recognitionResult.time}</p>
                   )}

                   <div className="absolute bottom-12 left-0 right-0">
                     <div className="h-1.5 w-full max-w-md mx-auto bg-white/20 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-white/80 transition-all duration-1000 ease-linear"
                         style={{ width: `${(resetCountdown / 4) * 100}%` }}
                       ></div>
                     </div>
                   </div>
                 </>
               )}

               {recognitionResult.type === 'unknown' && (
                 <>
                   <AlertTriangle size={120} className="text-red-500 drop-shadow-2xl mb-8 animate-pulse" />
                   <h2 className="text-5xl md:text-7xl font-black text-red-500 drop-shadow-2xl mb-6">UNRECOGNIZED FACE</h2>
                   <p className="text-2xl text-white/80 max-w-2xl text-center leading-relaxed drop-shadow-lg">
                     Face not found in database. <strong>HR has been securely notified</strong> with your image for immediate registration.
                   </p>
                   
                   <div className="absolute bottom-12 left-0 right-0">
                     <div className="h-1.5 w-full max-w-md mx-auto bg-white/20 rounded-full overflow-hidden">
                       <div 
                         className="h-full bg-red-500/80 transition-all duration-1000 ease-linear"
                         style={{ width: `${(resetCountdown / 6) * 100}%` }}
                       ></div>
                     </div>
                   </div>
                 </>
               )}
            </div>
          )}

      </div>
    </div>
  );
}
