'use client';

import { vitNodeConfig } from '@/vitnode.config';
import { GlobalErrorView } from '@vitnode/core/views/error/global-error-view';

import './globals.css';

import { Geist, Geist_Mono } from 'next/font/google';

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
