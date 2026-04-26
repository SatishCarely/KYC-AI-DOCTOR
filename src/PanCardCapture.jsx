import React, { useState, useRef, useEffect, useCallback } from 'react';

const API_POLL_INTERVAL = 2000;

export default function PanCardCapture({ apiBase, onComplete, onSkip }) {
  const [sessionId, setSessionId] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [status, setStatus] = useState('idle');
  const [ocrResult, setOcrResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [mode, setMode] = useState('qr');
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const createSession = async () => {
      try {
        const res = await fetch(`${apiBase}/api/pan/create-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) throw new Error(data.error || 'Failed to create session');

        setSessionId(data.sessionId);
        setQrCodeUrl(data.qrCodeDataUrl);
        setMobileUrl(data.mobileUrl);
        setStatus('waiting');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err.message);
          setStatus('error');
        }
      }
    };

    createSession();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  useEffect(() => {
    if (mode !== 'qr' || !sessionId || status === 'complete') return undefined;

    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/api/pan/status/${sessionId}`);
        const data = await res.json();

        if (data.status === 'complete') {
          setStatus('complete');
          setOcrResult(data.ocrResult);
          clearInterval(pollRef.current);
        }
      } catch {
        // Ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, API_POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [apiBase, mode, sessionId, status]);

  const handleFileSelect = useCallback((side, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (side === 'front') {
        setFrontFile(file);
        setFrontPreview(ev.target.result);
      } else {
        setBackFile(file);
        setBackPreview(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const uploadDesktop = async () => {
    if (!frontFile || !backFile || !sessionId) return;
    setIsUploading(true);

    try {
      const form = new FormData();
      form.append('front', frontFile);
      form.append('back', backFile);

      const res = await fetch(`${apiBase}/api/pan/upload-desktop/${sessionId}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setStatus('complete');
      setOcrResult(data.ocrResult);
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleProceed = () => {
    onComplete?.(ocrResult && !ocrResult.error ? ocrResult : null);
  };

  const s = {
    wrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      padding: 32,
      background: '#000',
    },
    box: {
      width: '100%',
      maxWidth: 520,
      background: '#0d0d14',
      borderRadius: 20,
      padding: 36,
      border: '1px solid rgba(255,255,255,0.06)',
    },
    title: {
      fontSize: 22,
      fontWeight: 700,
      color: '#e2e8f0',
      marginBottom: 6,
      textAlign: 'center',
    },
    sub: {
      fontSize: 13,
      color: '#64748b',
      textAlign: 'center',
      marginBottom: 28,
      lineHeight: 1.5,
    },
    tabs: {
      display: 'flex',
      gap: 4,
      marginBottom: 28,
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      padding: 4,
    },
    tab: (active) => ({
      flex: 1,
      padding: '10px 0',
      border: 'none',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      textAlign: 'center',
      transition: 'all 0.2s',
      background: active ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : 'transparent',
      color: active ? '#fff' : '#64748b',
    }),
    qrWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 20,
    },
    qrBox: {
      padding: 16,
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 8px 32px rgba(139,92,246,0.15)',
    },
    qrImg: { width: 240, height: 240, display: 'block' },
    urlBox: {
      padding: '8px 14px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 8,
      fontSize: 11,
      color: '#94a3b8',
      wordBreak: 'break-all',
      textAlign: 'center',
      maxWidth: 380,
    },
    waitDot: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#a78bfa',
      animation: 'fadeInOut 1.5s ease-in-out infinite',
    },
    waitText: { fontSize: 13, color: '#a78bfa', fontWeight: 500 },
    desktopGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
    dropZone: (hasFile) => ({
      aspectRatio: '1.58',
      borderRadius: 14,
      overflow: 'hidden',
      cursor: 'pointer',
      border: hasFile ? '2px solid #34d399' : '2px dashed #334155',
      background: hasFile ? 'rgba(52,211,153,0.05)' : '#0f172a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      transition: 'all 0.2s',
    }),
    dropLabel: { fontSize: 12, color: '#475569', textAlign: 'center', padding: 16 },
    dropImg: { width: '100%', height: '100%', objectFit: 'cover' },
    sideLabel: {
      fontSize: 11,
      fontWeight: 600,
      color: '#94a3b8',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      textAlign: 'center',
    },
    uploadBtn: (ready) => ({
      width: '100%',
      padding: 14,
      border: 'none',
      borderRadius: 12,
      fontSize: 14,
      fontWeight: 600,
      cursor: ready ? 'pointer' : 'default',
      marginTop: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      transition: 'all 0.2s',
      background: ready ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : 'rgba(255,255,255,0.06)',
      color: ready ? '#fff' : '#475569',
      opacity: ready ? 1 : 0.6,
    }),
    successBox: { textAlign: 'center', padding: '20px 0' },
    successIcon: {
      width: 72,
      height: 72,
      borderRadius: '50%',
      margin: '0 auto 16px',
      background: 'linear-gradient(135deg,#34d399,#059669)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 0 30px rgba(52,211,153,0.2)',
    },
    ocrRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontSize: 13,
      gap: 12,
    },
    ocrLabel: { color: '#64748b', fontWeight: 500 },
    ocrVal: { color: '#e2e8f0', fontWeight: 600, textAlign: 'right' },
    proceedBtn: {
      width: '100%',
      padding: 16,
      border: 'none',
      borderRadius: 14,
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      marginTop: 24,
      background: 'linear-gradient(135deg,#34d399,#059669)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    skipBtn: {
      width: '100%',
      padding: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      background: 'transparent',
      color: '#64748b',
      fontSize: 13,
      cursor: 'pointer',
      marginTop: 12,
      textAlign: 'center',
    },
  };

  if (status === 'complete') {
    const ocr = ocrResult && !ocrResult.error ? ocrResult : null;
    return (
      <div style={s.wrap}>
        <div style={s.box}>
          <div style={s.successBox}>
            <div style={s.successIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
              PAN Card Captured
            </div>
            {ocr ? (
              <div style={{ marginTop: 20, textAlign: 'left', padding: '0 16px' }}>
                {ocr.fullName && <div style={s.ocrRow}><span style={s.ocrLabel}>Name</span><span style={s.ocrVal}>{ocr.fullName}</span></div>}
                {ocr.panNumber && <div style={s.ocrRow}><span style={s.ocrLabel}>PAN</span><span style={s.ocrVal}>{ocr.panNumber}</span></div>}
                {ocr.dateOfBirth && <div style={s.ocrRow}><span style={s.ocrLabel}>DOB</span><span style={s.ocrVal}>{ocr.dateOfBirth}</span></div>}
                {ocr.fatherName && <div style={s.ocrRow}><span style={s.ocrLabel}>Father</span><span style={s.ocrVal}>{ocr.fatherName}</span></div>}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 12 }}>
                Images uploaded. Details will be verified during the call.
              </div>
            )}
          </div>
          <button style={s.proceedBtn} onClick={handleProceed}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94" />
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Proceed to Verification Call
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={s.title}>PAN Card Verification</div>
        <div style={s.sub}>
          Scan the QR code with your phone to capture your PAN card,
          or upload images from this computer.
        </div>

        <div style={s.tabs}>
          <button style={s.tab(mode === 'qr')} onClick={() => setMode('qr')}>
            Scan with Phone
          </button>
          <button style={s.tab(mode === 'desktop')} onClick={() => setMode('desktop')}>
            Upload from Computer
          </button>
        </div>

        {mode === 'qr' && (
          <div style={s.qrWrap}>
            {qrCodeUrl ? (
              <>
                <div style={s.qrBox}>
                  <img src={qrCodeUrl} alt="Scan QR code" style={s.qrImg} />
                </div>
                <div style={s.urlBox}>
                  Or open on your phone: <strong>{mobileUrl}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <div style={s.waitDot} />
                  <span style={s.waitText}>Waiting for images from your phone...</span>
                </div>
              </>
            ) : status === 'error' ? (
              <div style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>
                {errorMsg || 'Failed to generate QR code'}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid rgba(139,92,246,0.3)', borderTopColor: '#a78bfa', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
                <span style={{ color: '#a78bfa', fontSize: 13 }}>Generating QR code...</span>
              </div>
            )}
          </div>
        )}

        {mode === 'desktop' && (
          <>
            <div style={s.desktopGrid}>
              <div>
                <div style={s.sideLabel}>Front</div>
                <div style={s.dropZone(!!frontPreview)} onClick={() => frontInputRef.current?.click()}>
                  {frontPreview ? (
                    <img src={frontPreview} alt="Front" style={s.dropImg} />
                  ) : (
                    <div style={s.dropLabel}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <div style={{ marginTop: 6 }}>Click to upload</div>
                    </div>
                  )}
                </div>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect('front', e)}
                />
              </div>
              <div>
                <div style={s.sideLabel}>Back</div>
                <div style={s.dropZone(!!backPreview)} onClick={() => backInputRef.current?.click()}>
                  {backPreview ? (
                    <img src={backPreview} alt="Back" style={s.dropImg} />
                  ) : (
                    <div style={s.dropLabel}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <div style={{ marginTop: 6 }}>Click to upload</div>
                    </div>
                  )}
                </div>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileSelect('back', e)}
                />
              </div>
            </div>

            <button
              style={s.uploadBtn(!!frontFile && !!backFile && !isUploading)}
              disabled={!frontFile || !backFile || isUploading}
              onClick={uploadDesktop}
            >
              {isUploading ? 'Uploading...' : 'Upload PAN Images'}
            </button>
          </>
        )}

        <button style={s.skipBtn} onClick={() => onSkip?.()}>
          Skip for now
        </button>
      </div>
      <style>{`@keyframes fadeInOut{0%,100%{opacity:.4}50%{opacity:1}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
