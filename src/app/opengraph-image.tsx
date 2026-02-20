import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Swapify — Swap songs with friends';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const calSansData = await readFile(
    join(process.cwd(), 'node_modules/cal-sans/fonts/webfonts/CalSans-SemiBold.ttf')
  );

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #081420 0%, #0a0a0a 60%, #0d1f2d 100%)',
        position: 'relative',
      }}
    >
      {/* Radial glow behind logo */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -55%)',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)',
          display: 'flex',
        }}
      />

      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 32,
        }}
      >
        {}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><g fill="#38BDF8" transform="translate(0,512) scale(0.1,-0.1)"><path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z"/></g></svg>'
          )}`}
          width={120}
          height={120}
          alt=""
        />
      </div>

      {/* Title */}
      <div
        style={{
          display: 'flex',
          fontSize: 64,
          fontFamily: 'CalSans',
          color: '#ffffff',
          letterSpacing: '-1px',
          marginBottom: 16,
        }}
      >
        Swapify
      </div>

      {/* Tagline */}
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          color: '#38BDF8',
          fontFamily: 'CalSans',
          letterSpacing: '0.5px',
        }}
      >
        Swap songs with friends
      </div>

      {/* Subtitle */}
      <div
        style={{
          display: 'flex',
          fontSize: 18,
          color: 'rgba(255,255,255,0.5)',
          marginTop: 16,
          maxWidth: 600,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        A shared playlist that clears as you listen
      </div>

      {/* Bottom border accent */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #38BDF8, #4ADE80, #38BDF8)',
          display: 'flex',
        }}
      />
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'CalSans',
          data: calSansData,
          style: 'normal',
          weight: 600,
        },
      ],
    }
  );
}
