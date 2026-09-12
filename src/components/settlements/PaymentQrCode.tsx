import { Alert } from '@/components/ui/Alert';

/** Shown when the payer picks "QR code" as how they paid. */
export function PaymentQrCode({ qrUrl, name }: { qrUrl: string | null; name: string }) {
  if (!qrUrl) {
    return (
      <Alert tone="info">
        {name} hasn&apos;t added a QR code yet — ask them to add one in Settings, or pick Cash instead.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <img src={qrUrl} alt={`${name}'s payment QR code`} className="h-48 w-48 rounded-lg object-contain" />
      <p className="text-sm text-slate-600">Scan to pay {name}</p>
    </div>
  );
}
