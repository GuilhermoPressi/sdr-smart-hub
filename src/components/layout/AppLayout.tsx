import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

export function AppLayout() {
  const { pathname } = useLocation();
  const isCRM = pathname === "/crm";

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <main className={isCRM ? "flex-1 overflow-hidden flex flex-col" : "flex-1 overflow-y-auto"}>
          {isCRM ? (
            <Outlet />
          ) : (
            <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto w-full animate-fade-in">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
