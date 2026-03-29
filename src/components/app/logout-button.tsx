"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      window.location.assign("/login");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="border-white/12 bg-white/8 text-white hover:bg-white/14"
      onClick={handleLogout}
      isLoading={isPending}
      loadingLabel="로그아웃 중"
    >
      로그아웃
    </Button>
  );
}
