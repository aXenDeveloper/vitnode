'use client';

import { vitNodeConfig } from '@/vitnode.config';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.css';

import { GlobalErrorView } from 'vitnode/views/error/global-error-view';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function GlobalError() {
  return (
    <GlobalErrorView
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      config={vitNodeConfig}
    />
  );
}
