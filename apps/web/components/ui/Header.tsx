
import Link from "next/link";
import Image from "next/image";
import { Archive } from "lucide-react";
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
                    <Link
                        href="/settings/archived"
                        aria-label="Open archived items"
                        title="Archived items"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-2.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-md transition-all hover:border-primary/50 hover:bg-muted/50 shadow-2xs"
                    >
                        <Archive className="h-3.5 w-3.5 text-primary" />
                        <span className="hidden sm:inline">Archived</span>
                    </Link>
                    <ThemeToggle />
                    <AnonymousSessionBadge />
                </div>
            </div>
        </header>
    )
}