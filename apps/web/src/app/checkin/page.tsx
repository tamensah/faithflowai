'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, Button, Card, Input } from '@faithflow-ai/ui';
import { trpc } from '../../lib/trpc';

type ScanResult = { eventId: string; code: string };

type BarcodeDetectorConstructor = new (options?: { formats: string[] }) => {
  detect: (video: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
};

export default function MobileCheckInPage() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get('eventId') ?? '';
  const initialCode = searchParams.get('code') ?? '';
  const [eventId, setEventId] = useState(initialEventId);
  const [code, setCode] = useState(initialCode);
  const [search, setSearch] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [origin, setOrigin] = useState('');
  const [kioskLink, setKioskLink] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorConstructor> | null>(null);
  const animationRef = useRef<number | null>(null);

  const { data, refetch } = trpc.attendance.kioskRoster.useQuery(
    { eventId, code, query: search || undefined, limit: 200 },
    { enabled: Boolean(eventId && code) }
  );
  const { mutate: kioskCheckIn } = trpc.attendance.kioskCheckIn.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });
  const { mutate: kioskCheckOut } = trpc.attendance.kioskCheckOut.useMutation({
    onSuccess: async () => {
      await refetch();
    },
  });

  const filtered = useMemo(() => data?.roster ?? [], [data?.roster]);

  const parseScanValue = (value: string): ScanResult | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      const nextEventId = url.searchParams.get('eventId');
      const nextCode = url.searchParams.get('code');
      if (nextEventId && nextCode) return { eventId: nextEventId, code: nextCode };
    } catch (error) {
      // Not a URL
    }

    if (trimmed.includes(':')) {
      const [nextEventId, nextCode] = trimmed.split(':');
      if (nextEventId && nextCode) return { eventId: nextEventId, code: nextCode };
    }

    return null;
  };

  const stopScanner = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setScannerActive(false);
  };

  const handleScanValue = (value: string) => {
    const parsed = parseScanValue(value);
    if (!parsed) {
      setScanError('Unable to parse QR code. Try again or paste the kiosk link.');
      return;
    }
    setEventId(parsed.eventId);
    setCode(parsed.code);
    setScanError(null);
    stopScanner();
  };

  const scanFrame = async () => {
    if (!detectorRef.current || !videoRef.current) return;
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      const rawValue = barcodes.find((entry) => entry.rawValue)?.rawValue;
      if (rawValue) {
        handleScanValue(rawValue);
        return;
      }
    } catch (error) {
      setScanError('Scanning failed. Try again or use manual entry.');
    }
    animationRef.current = requestAnimationFrame(scanFrame);
  };

  const startScanner = async () => {
    if (scannerActive) return;
    setScanError(null);
    try {
      const Detector = (window as any).BarcodeDetector as BarcodeDetectorConstructor | undefined;
      if (!Detector) {
        setScanError('Barcode scanning is not supported on this device.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new Detector({ formats: ['qr_code'] });
      setScannerActive(true);
      setScannerReady(true);
      animationRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      setScanError('Camera access denied or unavailable.');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
    return () => stopScanner();
  }, []);

  useEffect(() => {
    if (eventId && code && origin) {
      setKioskLink(`${origin}/kiosk?eventId=${eventId}&code=${code}`);
    }
  }, [code, eventId, origin]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Mobile Check-in</h1>
            <p className="mt-1 text-sm text-muted">Scan the event QR code or paste the kiosk link.</p>
          </div>
          <Badge variant="default">{data?.event?.title ?? 'Ready to scan'}</Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <video ref={videoRef} className="aspect-video w-full rounded-md bg-muted" muted playsInline />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={startScanner} disabled={scannerActive}>
                {scannerActive ? 'Scanning...' : 'Start scanner'}
              </Button>
              <Button variant="outline" onClick={stopScanner} disabled={!scannerActive}>
                Stop
              </Button>
            </div>
            {!scannerReady && (
              <p className="mt-2 text-xs text-muted">
                Camera access is required to scan. If unsupported, use manual entry below.
              </p>
            )}
            {scanError && <p className="mt-2 text-xs text-red-500">{scanError}</p>}
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Paste kiosk link"
              value={kioskLink}
              onChange={(e) => {
                setKioskLink(e.target.value);
                handleScanValue(e.target.value);
              }}
            />
            <Input placeholder="Event ID" value={eventId} onChange={(e) => setEventId(e.target.value)} />
            <Input placeholder="Check-in code" value={code} onChange={(e) => setCode(e.target.value)} />
            <p className="text-xs text-muted">Ask a staff member for the QR code if you need it.</p>
          </div>
        </div>
      </Card>

      {eventId && code ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{data?.event?.title ?? 'Event roster'}</h2>
              <p className="mt-1 text-sm text-muted">Search your name and check in.</p>
            </div>
            <Badge variant="default">
              {data?.roster?.length ?? 0} / {data?.totalCount ?? 0} shown
            </Badge>
          </div>
          <div className="mt-4">
            <Input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="mt-4 space-y-2 text-sm text-muted">
            {filtered.map((entry) => (
              <div key={entry.member.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {entry.member.firstName} {entry.member.lastName}
                    </p>
                    <p className="text-xs text-muted">{entry.member.email ?? entry.member.phone ?? '—'}</p>
                  </div>
                  {entry.status === 'CHECKED_IN' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => kioskCheckOut({ eventId, code, memberId: entry.member.id })}
                    >
                      Check out
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => kioskCheckIn({ eventId, code, memberId: entry.member.id })}>
                      Check in
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {!filtered.length && <p className="text-sm text-muted">No members found.</p>}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
