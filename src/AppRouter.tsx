import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LiveNetworkBar } from "@/components/relay/LiveNetworkBar";
import { HomePage } from "@/pages/HomePage";
import { RelaysPage } from "@/pages/RelaysPage";
import { RelayDetailPage } from "@/pages/RelayDetailPage";
import { SubmitPage } from "@/pages/SubmitPage";
import { AboutPage } from "@/pages/AboutPage";
import { ApiDocsPage } from "@/pages/ApiDocsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LookupPage } from "@/pages/LookupPage";
import { GraveyardPage } from "@/pages/GraveyardPage";
import { SoftwarePage } from "@/pages/SoftwarePage";
import { RecommenderPage } from "@/pages/RecommenderPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useLiveRelayStore } from "@/hooks/useLiveRelayStore";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AppLayout() {
  const { stats, enriching } = useLiveRelayStore();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <LiveNetworkBar stats={stats} enriching={enriching} />
      <ScrollToTop />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/relays" element={<RelaysPage />} />
          <Route path="/relay/:id" element={<RelayDetailPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/lookup" element={<LookupPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/api" element={<ApiDocsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/graveyard" element={<GraveyardPage />} />
          <Route path="/software" element={<SoftwarePage />} />
          <Route path="/recommend" element={<RecommenderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
