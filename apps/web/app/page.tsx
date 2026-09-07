import DevelopersModal from '@/components/home/DevelopersModal';
import HomeClient from '@/components/home/HomeClient';
import LegalModal from '@/components/home/LegalModal';

export default function HomePage() {
  return (
    <>
      <HomeClient />

      <footer className="w-full border-t-2 border-slate-900/80 dark:border-white/30 bg-white dark:bg-[#0c0f1d] py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          {/* Developers section with heart (modal popup for github links) */}
          <DevelopersModal />

          {/* Terms and Privacy Links with smooth open/close modal */}
          <LegalModal />
        </div>
      </footer>
    </>
  );
}
