'use client';

import Image from "next/image";
import Link from "next/link";
import AnonymousSessionBadge from '@/components/AnonymousSessionBadge';
import ThemeToggle from '@/components/ThemeToggle';

export default function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
            <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
                <Link href="/library" className="flex items-center gap-2.5 group">
                    <Image
                        src="/ARAL_SPACE_LOGO.png"
                        alt="Aral Space"
                        width={44}
                        height={44}
                        priority
                        className="h-11 w-11 rounded-2xl object-cover shadow-md shadow-primary/20 group-hover:scale-105 transition-transform"
                    />
                    <div>
                        <span className="text-sm font-extrabold tracking-tight text-foreground">Aral Space</span>
                        <span className="block text-[10px] font-semibold text-muted-foreground -mt-0.5">Your Space to Study</span>
                    </div>
                </Link>

                <div className="flex items-center gap-2.5">
                    <ThemeToggle />
                    <AnonymousSessionBadge />
                </div>
            </div>
        </header>
    )
}
