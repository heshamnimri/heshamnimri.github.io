import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import "./layout.css";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="site-container">
      <Sidebar />
      <main className="main-content">
        <MobileNav />
        {children}
      </main>
    </div>
  );
}
