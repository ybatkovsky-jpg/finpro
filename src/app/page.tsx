"use client"

import { useSession } from "next-auth/react"
import { AppLayout } from "@/components/layout/app-layout"
import { SignInForm } from "@/components/auth/signin-form"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg">
            <span className="text-2xl font-bold text-white">FP</span>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return <SignInForm />
  }

  return <AppLayout />
}
