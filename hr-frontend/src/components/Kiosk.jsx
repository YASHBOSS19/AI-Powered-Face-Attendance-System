import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, RefreshCw, FlipHorizontal, Play, Pause, LogIn, LogOut, CheckCircle2, AlertCircle, X, ChevronLeft } from 'lucide-react';
import { apiCall, getProfileImageUrl } from '../api';

export default function Kiosk() {
  const navigate = useNavigate();
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const [isFlipped, setIsFlipped] = useState(true);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [recognitionResult, setRecognitionResult] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const autoScanTimerRef = useRef(null);
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

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance(text);
      msg.rate = 1.0;
      msg.pitch = 1.5;
      
      const voices = voicesRef.current.length > 0 ? voicesRef.current : window.speechSynthesis.getVoices();
      let femaleVoice = voices.find(voice => 
        /Google UK English Female|Zira|Hazel|Samantha|Victoria/i.test(voice.name)
      );
      if (!femaleVoice) femaleVoice = voices.find(voice => voice.name.toLowerCase().includes('female'));
      if (!femaleVoice && voices.length > 0) femaleVoice = voices.find(voice => !/david|male|mark/i.test(voice.name));
      if (femaleVoice) msg.voice = femaleVoice;
      
      window.speechSynthesis.speak(msg);
    }
  };

  // Stop webcam on unmount
  useEffect(() => {
    return () => {
      stopWebcam();
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, []);

  // Auto-scan interval when camera is ON & autoScan enabled
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

  const startWebcam = async () => {
    try {
      if ('speechSynthesis' in window) {
        // Unlock speech synthesis engine with a silent utterance
        const unlockMsg = new SpeechSynthesisUtterance('');
        unlockMsg.volume = 0;
        window.speechSynthesis.speak(unlockMsg);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setIsCapturing(true);
      setRecognitionResult(null);
    } catch (err) {
      console.error('Error accessing webcam', err);
      alert('Could not access webcam. Please ensure permissions are granted.');
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
    
    if (overlayCanvasRef.current) {
      const oCtx = overlayCanvasRef.current.getContext('2d');
      oCtx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }
  };

  const scanFace = async () => {
    if (!videoRef.current || !isCapturing || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isFlipped) {
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const dataUrl = canvas.toDataURL('image/jpeg');

    try {
      const data = await apiCall('/recognize', {
        method: 'POST',
        body: JSON.stringify({ image: dataUrl, threshold: 0.35 })
      });

      const facesList = data.faces || data.recognitions || [];
      
      const overlayCanvas = overlayCanvasRef.current;
      if (overlayCanvas && video) {
         overlayCanvas.width = video.videoWidth || 640;
         overlayCanvas.height = video.videoHeight || 480;
         const oCtx = overlayCanvas.getContext('2d');
         oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
         
         facesList.forEach(face => {
            if (face.box) {
                const [left, top, right, bottom] = face.box;
                const color = face.name !== 'unknown' ? '#10b981' : '#ef4444';
                oCtx.strokeStyle = color;
                oCtx.lineWidth = 4;
                oCtx.strokeRect(left, top, right - left, bottom - top);
                
                oCtx.fillStyle = color;
                oCtx.font = 'bold 28px Arial';
                const displayName = face.name !== 'unknown' ? (face.name.split('_')[1] || face.name) : 'Unknown';
                oCtx.fillText(displayName, left, top > 30 ? top - 10 : top + 30);
            }
         });
      }

      if (data.status === 'success' && facesList.length > 0) {
        const first = facesList[0];
        if (first.name && first.name !== 'unknown') {
          let displayName = first.name;
          const empId = first.employee_id || '';

          if (empId && displayName.startsWith(empId)) {
            displayName = displayName.substring(empId.length).replace(/^[_ -]+/, '').replace(/_/g, ' ').trim() || displayName;
          } else if (displayName.startsWith('EMP_') || displayName.startsWith('EMP-')) {
            const parts = displayName.split('_');
            if (parts.length >= 3) {
              displayName = parts.slice(2).join(' ');
            }
          }

          setRecognitionResult({
            type: 'prompt',
            rawName: first.name,
            displayName,
            empId,
            profilePicture: first.profile_picture,
            confidence: (first.confidence * 100).toFixed(1),
            todayStatus: first.today_status || {}
          });
          
          if (first.today_status && first.today_status.checkout) {
            speak(`${spokenName}, attendance already completed for today.`);
            setTimeout(() => setRecognitionResult(null), 4000); // auto dismiss after speaking
          } else {
            speak(`${spokenName} detected. Please select an action.`);
          }
        } else {
          setRecognitionResult({ type: 'unknown', message: 'No face recognized in dataset.' });
          speak('Unknown face detected.');
        }
      } else if (facesList.length === 0) {
        setRecognitionResult({ type: 'error', message: 'No face detected in the frame.' });
      } else {
        setRecognitionResult({ type: 'error', message: data.message || 'Recognition failed.' });
      }
    } catch (err) {
      setRecognitionResult({ type: 'error', message: err.message || 'Failed to connect to recognition server.' });
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
      setRecognitionResult({
        type: 'confirmed',
        displayName: recognitionResult.displayName,
        empId: recognitionResult.empId,
        action: actionType,
        message: outcome.message || (actionType === 'checkin' ? 'Check-in Recorded' : 'Check-out Recorded'),
        status: (outcome.status || 'present').toUpperCase(),
        time: actionType === 'checkin' ? outcome.checkin : outcome.checkout
      });
      speak(`${recognitionResult.displayName}, ${actionType === 'checkin' ? 'Check in' : 'Check out'} successful.`);
      setTimeout(() => setRecognitionResult(null), 3500);
    } catch (err) {
      console.error('Action error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const dismissPrompt = () => {
    setRecognitionResult(null);
  };

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div 
            onClick={() => { if (window.history.length > 1) navigate(-1); else navigate('/'); }}
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors shrink-0 text-gray-500 hover:text-brand-navy shadow-sm bg-white" 
            title="Back to Previous Page"
          >
            <ChevronLeft size={20} />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">HR Live Attendance Scanner</h2>
            <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Recognize faces and select explicit Check In or Check Out actions.</p>
          </div>
        </div>
      </div>

      <div className="w-full bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-8">
        
        {/* Camera Feed Container */}
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full aspect-video bg-gray-900 rounded-2xl overflow-hidden relative shadow-inner mb-4 flex items-center justify-center border-4 border-gray-100">
            {!isCapturing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900 z-10">
                <Camera size={48} className="mb-2 opacity-50" />
                <p className="font-medium">Camera Inactive</p>
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

            <canvas ref={canvasRef} className="hidden"></canvas>
            <canvas 
              ref={overlayCanvasRef} 
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-20 ${isCapturing ? 'block' : 'hidden'}`} 
            ></canvas>

            {/* Target Overlay Line */}
            {isCapturing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={`w-64 h-64 border-2 rounded-2xl transition-all duration-300 ${
                  loading ? 'border-teal-400 scale-105 shadow-[0_0_20px_rgba(45,212,191,0.4)]' : 'border-blue-400/40'
                }`}></div>
              </div>
            )}
          </div>

          {/* Camera Action Buttons */}
          <div className="flex flex-wrap gap-3 w-full">
            {!isCapturing ? (
              <button 
                onClick={startWebcam}
                className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2"
              >
                <Camera size={20} /> Turn On Camera
              </button>
            ) : (
              <>
                <button 
                  onClick={stopWebcam}
                  className="bg-red-50 text-red-600 font-semibold px-4 py-3 rounded-xl hover:bg-red-100 transition border border-red-100 text-sm"
                >
                  Turn Off
                </button>
                <button 
                  onClick={() => setIsFlipped(!isFlipped)}
                  title="Toggle Mirror Camera"
                  className="bg-gray-100 text-gray-700 font-semibold px-4 py-3 rounded-xl hover:bg-gray-200 transition flex items-center gap-1.5 text-sm"
                >
                  <FlipHorizontal size={18} /> Mirror
                </button>
                <button 
                  onClick={() => setAutoScan(!autoScan)}
                  className={`px-4 py-3 rounded-xl font-semibold transition border flex items-center gap-1.5 text-sm ${
                    autoScan ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  {autoScan ? <Pause size={16} /> : <Play size={16} />}
                  <span>{autoScan ? 'Auto-Scan ON' : 'Auto-Scan OFF'}</span>
                </button>
                <button 
                  onClick={scanFace}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-brand-navy to-brand-teal text-white font-bold py-3 rounded-xl hover:opacity-95 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-70 text-sm"
                >
                  {loading ? (
                    <><RefreshCw className="animate-spin" size={18} /> Scanning...</>
                  ) : (
                    <><Camera size={18} /> Click Image / Scan Now</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:w-80 flex flex-col">
          <h3 className="font-semibold text-lg text-gray-700 mb-4 border-b pb-2">Recognition Result</h3>

          <div className="flex-1 flex flex-col justify-center items-center p-6 bg-gray-50 rounded-2xl border border-gray-200 min-h-[300px]">
            {!recognitionResult && !loading && (
              <p className="text-gray-400 text-center text-sm">Position face in frame or click "Click Image / Scan Now".</p>
            )}

            {loading && (
              <div className="flex flex-col items-center text-brand-teal">
                <RefreshCw className="animate-spin mb-3" size={32} />
                <p className="font-medium text-sm">Analyzing face...</p>
              </div>
            )}

            {recognitionResult && !loading && (
              <div className="w-full text-center relative">
                {recognitionResult.type === 'prompt' && (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <button 
                      onClick={dismissPrompt}
                      className="absolute -top-2 right-0 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition"
                    >
                      <X size={18} />
                    </button>

                    {recognitionResult.profilePicture ? (
                      <img
                        src={getProfileImageUrl(recognitionResult.profilePicture)}
                        alt={recognitionResult.displayName}
                        className="w-16 h-16 rounded-full object-cover shadow-sm mx-auto mb-3 border-2 border-white ring-2 ring-blue-100"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.style.display = 'none';
                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-sm ${recognitionResult.profilePicture ? 'hidden' : 'flex'}`}>
                      {recognitionResult.displayName.charAt(0).toUpperCase()}
                    </div>

                    <h4 className="text-lg font-bold text-gray-800">{recognitionResult.displayName}</h4>
                    <p className="text-xs text-gray-400 mb-2">ID: {recognitionResult.empId || 'N/A'}</p>

                    <div className="bg-white border border-gray-200 rounded-xl p-2.5 mb-4 text-xs text-gray-600">
                      {recognitionResult.todayStatus?.has_record ? (
                        <span className="text-teal-600 font-medium">
                          Today: In {recognitionResult.todayStatus.checkin}
                          {recognitionResult.todayStatus.checkout ? ` | Out ${recognitionResult.todayStatus.checkout}` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">Not checked in today</span>
                      )}
                    </div>

                    {recognitionResult.todayStatus?.checkout ? (
                      <div className="w-full mt-2 p-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 shadow-sm flex items-center justify-center gap-2 text-sm">
                        <CheckCircle2 size={18} />
                        Attendance Completed
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-gray-700 mb-3">Select attendance action:</p>
                        <div className="flex gap-2 w-full">
                          {!recognitionResult.todayStatus?.has_record && (
                            <button
                              onClick={() => handleAttendanceAction('checkin')}
                              disabled={actionLoading}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-sm"
                            >
                              {actionLoading ? <RefreshCw className="animate-spin" size={14} /> : <LogIn size={14} />} Check In
                            </button>
                          )}

                          {recognitionResult.todayStatus?.has_record && !recognitionResult.todayStatus?.checkout && (
                            <button
                              onClick={() => handleAttendanceAction('checkout')}
                              disabled={actionLoading}
                              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-sm"
                            >
                              {actionLoading ? <RefreshCw className="animate-spin" size={14} /> : <LogOut size={14} />} Check Out
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {recognitionResult.type === 'confirmed' && (
                  <div className="animate-in fade-in zoom-in duration-300">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-bold shadow-sm">
                      <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-800">{recognitionResult.displayName}</h4>
                    <p className="text-xs font-semibold text-emerald-600 my-2">{recognitionResult.message}</p>
                    {recognitionResult.time && (
                      <p className="text-xs font-mono text-gray-500 bg-white border rounded-lg py-1 px-2 inline-block">
                        Time: {recognitionResult.time}
                      </p>
                    )}
                  </div>
                )}

                {recognitionResult.type === 'unknown' && (
                  <div className="animate-in fade-in zoom-in duration-300 text-center">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <AlertCircle size={32} />
                    </div>
                    <h4 className="text-lg font-bold text-gray-800 mb-1">Unknown Person</h4>
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded-xl border border-red-100">
                      Face not recognized in HR dataset.
                    </p>
                  </div>
                )}

                {recognitionResult.type === 'error' && (
                  <div className="text-orange-600 bg-orange-50 p-3 rounded-xl border border-orange-100 animate-in fade-in text-xs">
                    <p className="font-medium">{recognitionResult.message}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
