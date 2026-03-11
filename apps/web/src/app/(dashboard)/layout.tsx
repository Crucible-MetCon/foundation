import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{
          displayName: user.displayName ?? user.username,
          role: user.role,
          isAdmin: user.isAdmin,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          user={{
            displayName: user.displayName ?? user.username,
            role: user.role,
          }}
        />
        <main className="flex-1 overflow-auto bg-[var(--color-background)] p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
