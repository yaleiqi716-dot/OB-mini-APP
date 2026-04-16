"use client";

import NavHeader from "@/components/landing/NavHeader";
import HeroBackground from "@/components/landing/HeroBackground";
import HeroModern from "@/components/landing/HeroModern";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

export default function LandingContent() {
  return (
    <>
      <NavHeader />
      <HeroBackground />
      <HeroModern />
      <Pricing />
      <FAQ />
      <Footer />
    </>
  );
}
