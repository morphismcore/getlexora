"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sureler sayfasi kaldirildi.
 * Sure hesaplama artik dava detay sayfasinda "Olaylar & Sureler" sekmesinden yapiliyor.
 * Bu sayfa davalar sayfasina yonlendirir.
 */
export default function SurelerRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/davalar");
  }, [router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-5 h-5 border-2 border-[#6C6CFF] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-[13px] text-[#5C5C5F]">
          Sure hesaplama artik dava detay sayfasinda. Yonlendiriliyorsunuz...
        </p>
      </div>
    </div>
  );
}
