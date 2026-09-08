'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, Shield, RotateCcw, X, Smartphone, ArrowRightLeft, Copy, Check, AlertCircle, Loader2, Unplug, Link2 } from 'lucide-react';
import { setClientUserId } from '@/lib/authoringPreferences';
import { QRCodeSVG } from 'qrcode.react';
import { buildPairingUrl } from '@/lib/pairingUrl';
import AutoPairModal from '@/components/AutoPairModal';

const PAIRING_CONNECTION_STORAGE_KEY = 'quizmaster_pairing_connection';

interface AnonSessionData {
  isAnonymous: boolean;
  label: string;
  userId?: string;
}

type TabType = 'info' | 'share' | 'link';

export default function AnonymousSessionBadge() {
  const [session, setSession] = useState<AnonSessionData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [resetting, setResetting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Share state (Device 1)
  const [pairingTicketId, setPairingTicketId] = useState<string | null>(null);
  const [pairingPasscode, setPairingPasscode] = useState<string | null>(null);
  const [pairingFullCode, setPairingFullCode] = useState<string | null>(null);
  const [customPasscode, setCustomPasscode] = useState<string>('');
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [origin, setOrigin] = useState<string>('');
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Connect state (Device 2)
  const [inputTicketId, setInputTicketId] = useState('');
  const [inputPasscode, setInputPasscode] = useState('');
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/anonymous');
        if (res.ok) {
          const data = await res.json();
          setSession(data);
          if (data.userId) {
            setClientUserId(data.userId);
          }
          try {
            setIsConnected(window.localStorage.getItem(PAIRING_CONNECTION_STORAGE_KEY) === 'true');
          } catch {
            setIsConnected(false);
          }
        }
      } catch (err) {
        console.error('Failed to load anonymous session:', err);
      }
    }
    fetchSession();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Lock background scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Countdown timer for pairing code
  useEffect(() => {
    if (!codeExpiresAt) {
      setTimeLeft('');
      return;
    }

    function updateRemaining() {
      const now = Math.floor(Date.now() / 1000);
      const remaining = (codeExpiresAt || 0) - now;
      if (remaining <= 0) {
        setTimeLeft('Expired');
        setPairingTicketId(null);
        setPairingPasscode(null);
        setPairingFullCode(null);
        setCodeExpiresAt(null);
      } else {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [codeExpiresAt]);

  async function handleReset() {
    if (!confirm('Start a new anonymous session? Your current guest quizzes will remain under previous session ID.')) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch('/api/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      if (res.ok) {
        try {
          window.localStorage.removeItem(PAIRING_CONNECTION_STORAGE_KEY);
        } catch {
          // Connection marker is optional browser state.
        }
        window.location.reload();
      }
    } catch (err) {
      console.error('Reset failed:', err);
      setResetting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect this device from the connected guest session? Your quizzes will remain under the previous session.')) {
      return;
    }

    setDisconnecting(true);
    setDisconnectError(null);
    try {
      const res = await fetch('/api/anonymous/pair/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to disconnect guest session');
      }
      try {
        window.localStorage.removeItem(PAIRING_CONNECTION_STORAGE_KEY);
      } catch {
        // Connection marker is optional browser state.
      }
      window.location.reload();
    } catch (err: any) {
      console.error('Disconnect failed:', err);
      setDisconnectError(err.message || 'Unable to disconnect guest session');
      setDisconnecting(false);
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    setShareError(null);
    try {
      const payload = customPasscode.trim() ? { passcode: customPasscode.trim() } : {};
      const res = await fetch('/api/anonymous/pair/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate sync code');
      }
      setPairingTicketId(data.ticketId);
      setPairingPasscode(data.passcode);
      setPairingFullCode(data.fullCode);
      setCodeExpiresAt(data.expiresAt);
      setCustomPasscode('');
    } catch (err: any) {
      setShareError(err.message || 'Unable to generate pairing code');
    } finally {
      setGeneratingCode(false);
    }
  }

  async function handleCopyCode() {
    if (!pairingFullCode) return;
    try {
      await navigator.clipboard.writeText(pairingFullCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  const pairingQrValue = (pairingTicketId && pairingPasscode)
    ? buildPairingUrl(origin, pairingTicketId, pairingPasscode)
    : (pairingFullCode || '');

  async function handleCopyLink() {
    if (!pairingQrValue) return;
    try {
      await navigator.clipboard.writeText(pairingQrValue);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Copy link failed:', err);
    }
  }

  function handlePasteOrSplitInput(val: string, field: 'ticket' | 'passcode') {
    const trimmed = val.trim();
    // Check if user pasted full code like A7B2-123456 or A7B2 123456
    const match = trimmed.match(/^([A-Za-z0-9]{4})[- \t]+(\d{6})$/);
    if (match) {
      setInputTicketId(match[1].toUpperCase());
      setInputPasscode(match[2]);
      return;
    }
    if (field === 'ticket') {
      setInputTicketId(trimmed.toUpperCase().slice(0, 4));
    } else {
      setInputPasscode(trimmed.replace(/\D/g, '').slice(0, 6));
    }
  }

  async function handleRedeemCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanTicket = inputTicketId.trim().toUpperCase();
    const cleanPass = inputPasscode.replace(/\D/g, '');

    if (cleanTicket.length !== 4) {
      setLinkError('Please enter the 4-character Sync ID.');
      return;
    }
    if (cleanPass.length !== 6) {
      setLinkError('Please enter the 6-digit passcode.');
      return;
    }

    setLinking(true);
    setLinkError(null);
    setLinkSuccess(null);

    try {
      const res = await fetch('/api/anonymous/pair/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: cleanTicket,
          passcode: cleanPass,
          mode: syncMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sync session');
      }

      try {
        window.localStorage.setItem(PAIRING_CONNECTION_STORAGE_KEY, 'true');
      } catch {
        // Connection marker is optional browser state.
      }
      setLinkSuccess(data.message || 'Device synced successfully! Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: any) {
      setLinkError(err.message || 'Unable to connect device');
      setLinking(false);
    }
  }

  return (
    <>
      <AutoPairModal />
      <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md hover:border-primary/50 hover:bg-muted/50 transition-all shadow-2xs group"
        title="Anonymous Guest Profile (No Login Required)"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <UserCheck className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-bold text-foreground/90">
          {session ? session.label : 'Guest Mode'}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop blurring background on all screen sizes */}
          <div
            className="fixed inset-0 bg-background/80 dark:bg-black/70 backdrop-blur-md z-40 animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="absolute right-0 top-full mt-2.5 w-[calc(100vw-2rem)] max-w-[420px] sm:w-[420px] rounded-3xl border border-border/80 bg-card/95 p-5 sm:p-6 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in sm:zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-primary/10 text-primary shadow-2xs">
                  <Shield className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">Guest Session</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {session ? session.label : '100% Login-Free'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted/50 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="grid grid-cols-3 gap-1.5 mt-4 p-1 rounded-2xl bg-muted/60 border border-border/40 text-xs font-semibold text-muted-foreground">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs ${
                  activeTab === 'info'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'hover:text-foreground hover:bg-card/30'
                }`}
              >
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Overview</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('share')}
                className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs ${
                  activeTab === 'share'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'hover:text-foreground hover:bg-card/30'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Share</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('link')}
                className={`py-2 px-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs ${
                  activeTab === 'link'
                    ? 'bg-card text-foreground shadow-xs font-bold'
                    : 'hover:text-foreground hover:bg-card/30'
                }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Connect</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'info' && (
              <div className="py-4 space-y-3.5">
                <p className="leading-relaxed text-xs text-muted-foreground">
                  No password or email required. Your guest profile is stored safely in your browser. You can link quizzes across devices using a short-lived sync code.
                </p>

                {disconnectError && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{disconnectError}</span>
                  </div>
                )}

                {isConnected && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-2.5">
                    <div>
                      <div className="text-xs font-bold text-foreground">Connected to a synced guest session</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Disconnect to create a new guest ID on this device. Your quizzes stay with the connected session.
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={disconnecting}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-background px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/5 transition-all disabled:opacity-50"
                    >
                      <Unplug className="h-3.5 w-3.5" />
                      <span>{disconnecting ? 'Disconnecting...' : 'Disconnect Session'}</span>
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2.5">
                  <button
                    onClick={handleReset}
                    disabled={resetting}
                    className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 py-2 text-xs font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{resetting ? 'Resetting...' : 'New Session'}</span>
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary/90 transition-all shadow-xs"
                  >
                    Got it
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: SHARE TO PHONE (Device 1) */}
            {activeTab === 'share' && (
              <div className="py-4 space-y-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generate a short-lived sync code to connect this session to your mobile phone or another browser. You can reuse it on additional devices until it expires.
                </p>

                {shareError && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{shareError}</span>
                  </div>
                )}

                {pairingTicketId && pairingPasscode ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center space-y-3.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Active Pairing Code
                    </div>

                    <div className="flex flex-col items-center justify-center gap-4">
                      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scan to auto-connect</span>
                        <QRCodeSVG
                          value={pairingQrValue}
                          size={144}
                          level="M"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#111827"
                          title="Scan this QR code with your phone camera to auto-connect"
                        />
                        <span className="text-[10px] text-muted-foreground">Scan with phone camera to open website</span>
                      </div>

                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Sync ID</span>
                            <span className="bg-card px-3 py-1.5 rounded-xl border border-border/80 font-mono text-xl font-black text-foreground shadow-2xs tracking-wider">
                              {pairingTicketId}
                            </span>
                          </div>
                          <span className="text-muted-foreground font-bold text-xl mt-4">-</span>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Passcode</span>
                            <span className="bg-card px-3 py-1.5 rounded-xl border border-border/80 font-mono text-xl font-black text-foreground shadow-2xs tracking-widest">
                              {pairingPasscode.slice(0, 3)} {pairingPasscode.slice(3)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-4">
                          <button
                            onClick={handleCopyCode}
                            className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground shadow-2xs"
                            title="Copy pairing code"
                          >
                            {copiedCode ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={handleCopyLink}
                            className="p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground shadow-2xs"
                            title="Copy direct sync link"
                          >
                            {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {timeLeft && (
                      <div className="text-xs font-semibold text-muted-foreground">
                        Expires in: <span className="font-mono text-primary font-bold">{timeLeft}</span>
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground">
                      On your other device, tap <strong>Connect</strong> and enter this Sync ID & passcode. The code remains reusable until it expires.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground">
                        Custom 6-Digit Passcode (Optional)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Auto-generate 6 digits"
                        value={customPasscode}
                        onChange={(e) => setCustomPasscode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full text-center tracking-widest font-mono text-sm rounded-xl border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-hidden transition-all"
                      />
                    </div>

                    <button
                      onClick={handleGenerateCode}
                      disabled={generatingCode}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-white hover:bg-primary/90 transition-all shadow-xs disabled:opacity-60"
                    >
                      {generatingCode ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Generating Code...</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="h-4 w-4" />
                          <span>Generate Sync Code</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CONNECT DEVICE (Device 2) */}
            {activeTab === 'link' && (
              <form onSubmit={handleRedeemCode} className="py-4 space-y-3.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter the Sync ID and 6-digit passcode displayed on your other device.
                </p>

                {linkError && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-medium">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{linkError}</span>
                  </div>
                )}

                {linkSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>{linkSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Sync ID</label>
                    <input
                      type="text"
                      maxLength={12}
                      placeholder="e.g. A7B2"
                      value={inputTicketId}
                      onChange={(e) => handlePasteOrSplitInput(e.target.value, 'ticket')}
                      disabled={linking || Boolean(linkSuccess)}
                      className="w-full text-center tracking-widest font-mono text-sm font-extrabold rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-hidden transition-all placeholder:text-muted-foreground/40 uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">6-Digit Passcode</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="000 000"
                      value={inputPasscode}
                      onChange={(e) => handlePasteOrSplitInput(e.target.value, 'passcode')}
                      disabled={linking || Boolean(linkSuccess)}
                      className="w-full text-center tracking-widest font-mono text-sm font-extrabold rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-hidden transition-all placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>

                {/* Merge vs Replace Mode */}
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Sync Options
                  </div>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="syncMode"
                      value="merge"
                      checked={syncMode === 'merge'}
                      onChange={() => setSyncMode('merge')}
                      className="mt-0.5 text-primary focus:ring-0"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-foreground">Merge quizzes (Recommended)</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Use the primary device&apos;s guest ID and combine both devices&apos; quizzes. Previously connected devices keep using this session.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-2xl border border-border/70 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="syncMode"
                      value="replace"
                      checked={syncMode === 'replace'}
                      onChange={() => setSyncMode('replace')}
                      className="mt-0.5 text-primary focus:ring-0"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-foreground">Replace session</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">Switch completely to primary device session.</div>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={linking || Boolean(linkSuccess) || inputTicketId.trim().length !== 4 || inputPasscode.trim().length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-xs font-bold text-white hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 mt-1"
                >
                  {linking ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Syncing Session...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4" />
                      <span>Connect & Sync</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </>
      )}
      </div>
    </>
  );
}

