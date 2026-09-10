import Header from '@/components/ui/Header';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="w-full min-h-[calc(100vh-4rem)]">
        {children}
      </main>
    </>
  );
}
