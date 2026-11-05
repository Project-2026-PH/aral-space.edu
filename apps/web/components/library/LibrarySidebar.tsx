'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Classroom } from '@quiz-creator/types';
import {
  Archive,
  BookOpen,
  LayoutDashboard,
  Layers,
  Menu,
  Share2,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

type LibrarySidebarView = 'overview' | 'subjects' | 'reviewers' | 'shared' | 'classes';

interface LibrarySidebarProps {
  activeView: LibrarySidebarView;
  onSelect: (view: LibrarySidebarView) => void;
  totalCount: number;
  setCount: number;
  subjectCount: number;
  sharedCount: number;
  classCount: number;
  classrooms: Classroom[];
  selectedClassId: string;
  onSelectClass: (classroomId: string) => void;
}

interface NavigationItem {
  id: LibrarySidebarView;
  label: string;
  count: number;
  icon: LucideIcon;
}

export default function LibrarySidebar({
  activeView,
  onSelect,
  totalCount,
  setCount,
  subjectCount,
  sharedCount,
  classCount,
  classrooms,
  selectedClassId,
  onSelectClass,
}: LibrarySidebarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  const collapseMobileNavigation = useCallback(() => {
    setMobileExpanded(false);
    if (window.innerWidth < 1024) {
      window.requestAnimationFrame(() => mobileToggleRef.current?.focus());
    }
  }, []);

  const groups: Array<{ label: string; items: NavigationItem[] }> = [
    {
      label: 'LIBRARY',
      items: [
        { id: 'overview', label: 'Overview', count: totalCount, icon: LayoutDashboard },
      ],
    },
    {
      label: 'YOUR MATERIALS',
      items: [
        { id: 'reviewers', label: 'Sets', count: setCount, icon: Layers },
        { id: 'subjects', label: 'Subjects', count: subjectCount, icon: BookOpen },
        { id: 'classes', label: 'Classes', count: classCount, icon: Users },
      ],
    },
    {
      label: 'SHARED WITH YOU',
      items: [
        { id: 'shared', label: 'Shared', count: sharedCount, icon: Share2 },
      ],
    },
  ];

  useEffect(() => {
    if (!mobileExpanded) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') collapseMobileNavigation();
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setMobileExpanded(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnDesktop);
    };
  }, [mobileExpanded, collapseMobileNavigation]);

  const chooseView = (view: LibrarySidebarView) => {
    onSelect(view);
    if (mobileExpanded) collapseMobileNavigation();
  };

  const chooseClassroom = (classroomId: string) => {
    onSelect('classes');
    onSelectClass(classroomId);
    if (mobileExpanded) collapseMobileNavigation();
  };

  const renderItem = (item: NavigationItem, compact = false) => {
    const Icon = item.icon;
    const isActive = activeView === item.id;

    return (
      <button
        key={item.id}
        type="button"
        title={compact ? item.label : undefined}
        aria-label={compact ? `${item.label}, ${item.count} items` : undefined}
        aria-current={isActive ? 'page' : undefined}
        onClick={() => chooseView(item.id)}
        className={`group relative flex w-full items-center rounded-xl border-2 text-left transition-all duration-200 ease-out motion-reduce:transition-none ${
          compact
            ? 'h-10 justify-center'
            : 'min-h-10 gap-3 px-3 py-2'
        } ${
          isActive
            ? 'border-slate-900 bg-[#fde047] text-slate-950 shadow-brutal-sm'
            : compact
              ? 'border-transparent text-slate-300 hover:border-white/50 hover:bg-white/10'
              : 'border-transparent text-slate-700 hover:border-slate-900 hover:bg-white hover:shadow-brutal-sm dark:text-slate-300 dark:hover:border-white/50 dark:hover:bg-slate-800'
        }`}
      >
        <Icon
          aria-hidden="true"
          className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
            isActive ? 'text-slate-950' : 'text-current'
          }`}
        />
        {compact ? (
          <span className="sr-only">{item.label}</span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.label}</span>
            <span className={`min-w-6 rounded-md border-2 px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums ${
              isActive
                ? 'border-slate-900 bg-white text-slate-900'
                : 'border-slate-900/20 bg-slate-100 text-slate-700 dark:border-white/30 dark:bg-slate-800 dark:text-slate-200'
            }`}>
              {item.count}
            </span>
          </>
        )}
      </button>
    );
  };

  return (
    <>
      <button
        type="button"
        tabIndex={mobileExpanded ? 0 : -1}
        aria-hidden={!mobileExpanded}
        aria-label="Close library navigation"
        onClick={collapseMobileNavigation}
        className={`fixed inset-x-0 bottom-0 top-16 z-40 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none lg:hidden ${
          mobileExpanded ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        aria-label="Library navigation"
        className={`fixed bottom-0 left-0 top-16 z-50 flex overflow-hidden border-r-3 border-slate-900 bg-slate-50 text-slate-900 shadow-brutal transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:border-white/50 dark:bg-card dark:text-white lg:fixed lg:left-4 lg:top-1/2 lg:-translate-y-1/2 lg:bottom-auto lg:z-30 lg:m-0 lg:h-auto lg:max-h-none lg:self-start lg:shrink-0 lg:rounded-2xl lg:border-3 ${
          mobileExpanded ? 'w-[17rem]' : 'w-14'
        } lg:w-[16rem] lg:shadow-brutal`}
      >
        <div className="relative z-10 flex h-full w-14 shrink-0 flex-col items-center border-r-3 border-slate-900 bg-slate-950 px-1.5 py-3 dark:border-white/40 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-brutal-sm dark:border-white/60">
            <Image
              src="/ARAL_SPACE_LOGO.png"
              alt="Aral Space"
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </div>

          <button
            ref={mobileToggleRef}
            type="button"
            onClick={() => setMobileExpanded((expanded) => !expanded)}
            aria-label={mobileExpanded ? 'Collapse library navigation' : 'Expand library navigation'}
            aria-expanded={mobileExpanded}
            aria-controls="library-sidebar-panel"
            className="mt-4 flex h-9 w-9 items-center justify-center rounded-lg border-2 border-white/60 bg-slate-900 text-white shadow-brutal-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-none motion-reduce:transition-none lg:hidden"
          >
            {mobileExpanded ? <X aria-hidden="true" className="h-4 w-4" /> : <Menu aria-hidden="true" className="h-4 w-4" />}
          </button>

          <div className="my-3 h-0.5 w-8 bg-white/30" />

          <nav aria-label="Library shortcuts" className="flex w-full flex-col gap-1">
            {groups.flatMap((group) => group.items).map((item) => renderItem(item, true))}
          </nav>

          <div className="mt-auto mb-1 flex h-9 w-9 items-center justify-center rounded-xl border-2 border-white/50 bg-[#fde047] text-[10px] font-black text-slate-950 shadow-brutal-sm">
            {totalCount > 99 ? '99+' : totalCount}
          </div>
        </div>

        <nav
          id="library-sidebar-panel"
          aria-label="Library sections"
          className={`absolute inset-y-0 left-14 z-0 flex w-[13.5rem] flex-col overflow-hidden border-l-0 border-slate-900 bg-white text-slate-900 transition-[opacity,transform,visibility] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:border-white/30 dark:bg-card dark:text-white lg:static lg:z-auto lg:h-auto lg:min-h-0 lg:w-[16rem] lg:shrink-0 lg:translate-x-0 lg:opacity-100 lg:visible lg:pointer-events-auto ${
            mobileExpanded
              ? 'visible translate-x-0 opacity-100'
              : 'invisible -translate-x-2 opacity-0 pointer-events-none'
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4 lg:flex-none lg:overflow-visible">
            <div className="mb-6 flex items-start justify-between gap-2 border-b-2 border-slate-900 px-1 pb-4 dark:border-white/30">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/ARAL_SPACE_LOGO.png"
                  alt="Aral Space"
                  width={40}
                  height={40}
                  className="hidden h-10 w-10 shrink-0 rounded-xl border-2 border-slate-900 object-cover shadow-brutal-sm dark:border-white/50 lg:block"
                />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black tracking-[0.2em] text-slate-900 dark:text-white">ARAL SPACE</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-600 dark:text-slate-400">Your study library</p>
                </div>
              </div>
              <button
                type="button"
                onClick={collapseMobileNavigation}
                aria-label="Collapse library navigation"
                className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-slate-900 bg-white text-slate-700 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal dark:border-white/40 dark:bg-slate-800 dark:text-slate-100 lg:hidden"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="mb-2 px-3 text-[9px] font-black tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {group.label}
                  </h2>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <div key={item.id} className="space-y-1">
                        {renderItem(item)}
                        {item.id === 'classes' && classrooms.length > 0 && (
                          <div aria-label="Your classes" className="ml-4 max-h-40 space-y-1 overflow-y-auto border-l-2 border-slate-900/15 pl-2 dark:border-white/15 lg:max-h-56">
                            {classrooms.map((classroom) => (
                              <button
                                key={classroom.id}
                                type="button"
                                onClick={() => chooseClassroom(classroom.id)}
                                aria-current={selectedClassId === classroom.id ? 'page' : undefined}
                                title={classroom.name}
                                className={`flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-left transition ${selectedClassId === classroom.id ? 'bg-[#fde047] font-black text-slate-950' : 'font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                              >
                                <span className="min-w-0 truncate text-xs">{classroom.name}</span>
                                <span className="shrink-0 text-[8px] font-black uppercase tracking-wide opacity-60">{classroom.role === 'member' ? 'joined' : 'owner'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-8 border-t-2 border-slate-900 pt-4 dark:border-white/30 lg:mt-28">
              <Link
                href="/settings/archived"
                className="group flex min-h-10 w-full items-center gap-3 rounded-xl border-2 border-transparent px-3 py-2 text-left text-[13px] font-semibold text-slate-700 transition-all duration-200 ease-out hover:border-slate-900 hover:bg-white hover:shadow-brutal-sm motion-reduce:transition-none dark:text-slate-300 dark:hover:border-white/50 dark:hover:bg-slate-800"
              >
                <Archive aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-current" />
                <span>Archived</span>
              </Link>
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
