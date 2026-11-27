import { QRCodeSVG } from 'qrcode.react';
import type { ExternalGame } from '../games.config';
import { AndroidIcon, ExternalIcon } from './icons';

// Mindtier's phone area. The QR codes are generated here as SVG (qrcode.react, no network calls), dark
// modules on a white tile with the standard 4-module quiet zone, so they scan from a dark page.
function Qr({ value, label }: { value: string; label: string }) {
  return (
    <span className="gm-qr__tile">
      <QRCodeSVG value={value} size={152} level="M" marginSize={4} bgColor="#ffffff" fgColor="#0a0a0a" title={label} role="img" aria-label={label} />
    </span>
  );
}

export function QrBlock({ game }: { game: ExternalGame }) {
  return (
    <div className="gm-qr">
      <figure className="gm-qr__card">
        <Qr value={game.playUrl} label={`QR code: ${game.playUrlLabel}`} />
        <figcaption>
          <span className="gm-qr__title">Scan to play on your phone</span>
          <a className="gm-qr__url" href={game.playUrl} target="_blank" rel="noopener noreferrer">
            {game.playUrlLabel}
          </a>
        </figcaption>
      </figure>

      {game.playStoreUrl ? (
        <figure className="gm-qr__card gm-qr__card--store">
          <Qr value={game.playStoreUrl} label="QR code: Mindtier on Google Play" />
          <figcaption>
            <span className="gm-qr__title">Get it on Android</span>
            <a className="gm-store" href={game.playStoreUrl} target="_blank" rel="noopener noreferrer">
              <AndroidIcon className="gm-store__icon" />
              Get it on Google Play
              <ExternalIcon className="gm-store__ext" />
            </a>
          </figcaption>
        </figure>
      ) : (
        <div className="gm-android">
          <span className="gm-android__icon" aria-hidden="true">
            <AndroidIcon />
          </span>
          <p className="gm-android__title">Android</p>
          <p className="gm-android__text">Coming to Google Play. A QR code for the store listing will appear here once it’s live.</p>
        </div>
      )}
    </div>
  );
}
