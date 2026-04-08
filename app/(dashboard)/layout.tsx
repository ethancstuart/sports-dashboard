import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { Providers } from "@/components/providers";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col lg:ml-56">
          <TopBar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
