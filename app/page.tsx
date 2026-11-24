import React from 'react';
import Navbar from '@/components/Navbar';
import BookStage from '@/components/BookStage';
import ChatWidget from '@/components/ChatWidget';

export default function HomePage() {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <Navbar />
      <BookStage />
      <ChatWidget />
    </div>
  );
}
